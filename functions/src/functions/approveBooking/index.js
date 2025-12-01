const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createHtmlResponse, createJsonResponse, resolveBaseUrl } = require('../../../shared/http');
const { getBooking, updateBookingStatus } = require('../../../shared/cosmosDb');

/**
 * Approve a booking via a direct link.
 */
app.http('approveBooking', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/approve',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204);
        }

        const id = request.query.get('id');
        const isApiRequest = request.method === 'POST' || request.headers.get('accept')?.includes('application/json');
        
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
            if (isApiRequest) {
                return createJsonResponse(200, { message: 'Booking was already approved.' });
            }
            return createHtmlResponse(200, '<p>Booking var allerede godkjent. Bekreftelse er tidligere sendt.</p>');
        }

        const updatedBooking = await updateBookingStatus(id.trim(), null, 'approved');
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
                
                // Generate contract link
                const baseUrl = resolveBaseUrl(request);
                
                let contractLink;
                if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
                    // Local dev: point to frontend port 3000
                    contractLink = `http://localhost:3000/leieavtale.html?id=${existingBooking.id}`;
                } else {
                    // Production: point to the main domain
                    // We assume the frontend is hosted at bjørkvang.no
                    contractLink = `https://bjørkvang.no/leieavtale.html?id=${existingBooking.id}`;
                }

                await sendEmail({
                    to: existingBooking.requesterEmail.trim(),
                    from,
                    subject: 'Din booking er godkjent – Signering av leieavtale',
                    text: `Hei ${safeName}!\n\nDin booking for ${safeDate} kl. ${safeTime} er godkjent.\n\nVennligst les og signer leieavtalen digitalt her:\n${contractLink}\n\nVennlig hilsen\nBjørkvang`,
                    html: `
                        <p>Hei ${safeName}!</p>
                        <p>Din booking for <strong>${safeDate} kl. ${safeTime}</strong> er nå godkjent.</p>
                        <p>For å bekrefte leieforholdet, vennligst les og signer leieavtalen digitalt:</p>
                        <p>
                            <a href="${contractLink}" style="display:inline-block;padding:12px 20px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;">
                                Åpne og signer leieavtale
                            </a>
                        </p>
                        <p>Hvis knappen ikke fungerer, kan du kopiere denne lenken:<br/>${contractLink}</p>
                        <p>Vennlig hilsen<br/>Bjorkvang.no</p>
                    `,
                });
                context.info(`approveBooking: Confirmation email with contract link sent to ${existingBooking.requesterEmail}`);
            }
        } catch (error) {
            context.error('approveBooking: Failed to send booking approval email', {
                error: error.message,
                stack: error.stack,
                bookingId: id
            });
        }

        if (isApiRequest) {
            return createJsonResponse(200, { message: 'Booking approved successfully.' });
        }
        return createHtmlResponse(200, '<p>Booking er nå godkjent og bekreftelse med kontraktlenke er sendt til forespørrer.</p>');
    },
});
