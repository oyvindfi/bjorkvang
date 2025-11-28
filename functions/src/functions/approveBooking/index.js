const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createHtmlResponse, createJsonResponse } = require('../../../shared/http');
const { getBooking, updateBookingStatus } = require('../../../shared/cosmosDb');

/**
 * Approve a booking via a direct link.
 */
app.http('approveBooking', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'booking/approve',
    handler: async (request, context) => {
        const id = request.query.get('id');
        
        // Validate booking ID
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            context.warn('approveBooking called with invalid or missing ID');
            return createJsonResponse(400, { error: 'Missing booking id.' });
        }

        const existingBooking = await getBooking(id.trim());
        if (!existingBooking) {
            context.warn(`approveBooking: Booking not found for ID: ${id}`);
            return createJsonResponse(404, { error: 'Booking not found.' });
        }

        if (existingBooking.status === 'approved') {
            context.info(`approveBooking: Booking ${id} was already approved`);
            return createHtmlResponse(200, '<p>Booking var allerede godkjent. Bekreftelse er tidligere sendt.</p>');
        }

        const updatedBooking = await updateBookingStatus(id.trim(), 'approved');
        if (!updatedBooking) {
            context.error(`approveBooking: Failed to update booking status for ID: ${id}`);
            return createJsonResponse(500, { error: 'Failed to approve booking.' });
        }
        
        context.info(`approveBooking: Successfully approved booking ${id} for ${existingBooking.requesterEmail}`);

        try {
            const from = process.env.DEFAULT_FROM_ADDRESS;
            if (!from) {
                context.warn('approveBooking: DEFAULT_FROM_ADDRESS is not set. Skipping confirmation email.');
            } else if (!existingBooking.requesterEmail || typeof existingBooking.requesterEmail !== 'string') {
                context.error('approveBooking: Invalid requester email in booking');
            } else {
                // Escape HTML to prevent XSS
                const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[m]);
                
                const safeName = escapeHtml(existingBooking.requesterName || 'Bruker');
                const safeDate = escapeHtml(existingBooking.date || '');
                const safeTime = escapeHtml(existingBooking.time || '');
                
                await sendEmail({
                    to: existingBooking.requesterEmail.trim(),
                    from,
                    subject: 'Din booking er godkjent',
                    text: `Hei ${safeName}! Booking ${safeDate} kl. ${safeTime} er godkjent. Vi sees!`,
                    html: `
                        <p>Hei ${safeName}!</p>
                        <p>Booking for ${safeDate} kl. ${safeTime} er nå godkjent.</p>
                        <p>Vennlig hilsen<br/>Bjorkvang.no</p>
                    `,
                });
                context.info(`approveBooking: Confirmation email sent to ${existingBooking.requesterEmail}`);
            }
        } catch (error) {
            context.error('approveBooking: Failed to send booking approval email', {
                error: error.message,
                stack: error.stack,
                bookingId: id
            });
        }

        return createHtmlResponse(200, '<p>Booking er nå godkjent og bekreftelse er sendt til forespørrer.</p>');
    },
});
