const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createHtmlResponse, createJsonResponse, parseBody } = require('../../../shared/http');
const { getBooking, updateBookingStatus } = require('../../../shared/cosmosDb');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

/**
 * Reject a booking via link or API call. Accepts optional message via POST.
 */
app.http('rejectBooking', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/reject',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            context.log('rejectBooking: Handled CORS preflight');
            return createJsonResponse(204, {}, request);
        }

        const id = request.query.get('id');
        const isApiRequest = request.method === 'POST' || request.headers.get('accept')?.includes('application/json');

        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            context.warn('rejectBooking called with invalid or missing ID');
            return createJsonResponse(400, { error: 'Missing booking id.' }, request);
        }

        const existingBooking = await getBooking(id.trim());
        if (!existingBooking) {
            context.warn(`rejectBooking: Booking not found for ID: ${id}`);
            return createJsonResponse(404, { error: 'Booking not found.' }, request);
        }

        if (existingBooking.status === 'rejected') {
            context.info(`rejectBooking: Booking ${id} was already rejected`);
            if (isApiRequest) {
                return createJsonResponse(200, { message: 'Booking was already rejected.' }, request);
            }
            return createHtmlResponse(200, '<p>Booking var allerede avvist. Forespørrer er informert.</p>', request);
        }

        let rejectionMessage = '';
        if (request.method === 'POST') {
            const body = await parseBody(request);
            rejectionMessage = (body.reason || '').trim();
            // Limit message length to prevent abuse
            if (rejectionMessage.length > 1000) {
                context.warn('rejectBooking: Rejection message too long, truncating');
                rejectionMessage = rejectionMessage.substring(0, 1000);
            }
        }

        const updatedBooking = await updateBookingStatus(id.trim(), null, 'rejected');
        if (!updatedBooking) {
            context.error(`rejectBooking: Failed to update booking status for ID: ${id}`);
            return createJsonResponse(500, { error: 'Failed to reject booking.' }, request);
        }
        
        context.info(`rejectBooking: Successfully rejected booking ${id} for ${existingBooking.requesterEmail}`);

        try {
            const from = process.env.DEFAULT_FROM_ADDRESS;
            if (!from) {
                context.warn('rejectBooking: DEFAULT_FROM_ADDRESS is not set. Skipping rejection email.');
            } else if (!existingBooking.requesterEmail || typeof existingBooking.requesterEmail !== 'string') {
                context.error('rejectBooking: Invalid requester email in booking');
            } else {
                // Escape HTML to prevent XSS
                const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[m]);
                
                const safeName = escapeHtml(existingBooking.requesterName || 'Bruker');
                const safeDate = escapeHtml(existingBooking.date || '');
                const safeTime = escapeHtml(existingBooking.time || '');
                const safeReason = escapeHtml(rejectionMessage);
                
                const reasonHtml = rejectionMessage
                    ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px; margin-top: 16px; color: #991b1b;"><strong>Årsak:</strong><br>${safeReason}</div>`
                    : '<p>Ta gjerne kontakt om du har spørsmål.</p>';

                const htmlContent = `
                    <p>Hei ${safeName},</p>
                    <p>Vi må dessverre informere om at din bookingforespørsel for <strong>${safeDate} kl. ${safeTime}</strong> ikke kunne godkjennes.</p>
                    ${reasonHtml}
                    <p style="margin-top: 24px;">Du er velkommen til å prøve å finne en annen dato i kalenderen vår.</p>
                    <p>Vennlig hilsen<br>Helgøens Vel</p>
                `;

                const html = generateEmailHtml({
                    title: 'Oppdatering på din booking',
                    content: htmlContent,
                    action: {
                        text: 'Se kalender',
                        url: 'https://bjørkvang.no/booking'
                    },
                    previewText: `Din booking for ${safeDate} ble dessverre avvist.`
                });

                await sendEmail({
                    to: existingBooking.requesterEmail.trim(),
                    from,
                    subject: 'Din booking ble dessverre avvist',
                    text: `Hei ${safeName}. Booking ${safeDate} kl. ${safeTime} ble avvist. ${rejectionMessage}`.trim(),
                    html: html,
                });
                context.info(`rejectBooking: Rejection email sent to ${existingBooking.requesterEmail}`);
            }
        } catch (error) {
            context.error('rejectBooking: Failed to send booking rejection email', {
                error: error.message,
                stack: error.stack,
                bookingId: id
            });
        }

        if (isApiRequest) {
            return createJsonResponse(200, { message: 'Booking rejected successfully.' }, request);
        }
        return createHtmlResponse(200, '<p>Booking er nå avvist og forespørrer er informert.</p>', request);
    },
});
