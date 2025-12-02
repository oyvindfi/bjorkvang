const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../../shared/http');
const { getBooking } = require('../../../shared/cosmosDb');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

app.http('sendReminder', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'booking/remind',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { id, comment } = body;

            if (!id) {
                return createJsonResponse(400, { error: 'Missing booking id.' });
            }

            const booking = await getBooking(id);
            if (!booking) {
                return createJsonResponse(404, { error: 'Booking not found.' });
            }

            // Determine what we are reminding about
            // Usually it's about signing the contract if status is approved
            // Or maybe just a general follow-up
            
            const baseUrl = resolveBaseUrl(request);
            let contractLink;
            if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
                contractLink = `http://localhost:3000/leieavtale?id=${booking.id}`;
            } else {
                contractLink = `https://bjørkvang.no/leieavtale?id=${booking.id}`;
            }

            const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[m]);

            const safeName = escapeHtml(booking.requesterName || 'Kunde');
            const safeComment = comment ? escapeHtml(comment) : null;
            const safeDate = escapeHtml(booking.date || '');

            let htmlContent = `
                <p>Hei ${safeName},</p>
                <p>Dette er en påminnelse vedrørende din booking på Bjørkvang forsamlingslokale (${safeDate}).</p>
            `;

            if (safeComment) {
                htmlContent += `
                    <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; font-style: italic;">
                        "${safeComment}"
                    </div>
                `;
            }

            htmlContent += `
                <p>Vennligst sjekk status på din booking og signer leieavtalen hvis du ikke allerede har gjort det.</p>
            `;

            const html = generateEmailHtml({
                title: 'Påminnelse om booking',
                content: htmlContent,
                action: {
                    text: 'Gå til leieavtale',
                    url: contractLink
                },
                previewText: `Påminnelse vedrørende din booking for ${safeDate}.`
            });

            await sendEmail({
                to: booking.requesterEmail,
                from: process.env.DEFAULT_FROM_ADDRESS,
                subject: `Påminnelse: Booking ${safeDate}`,
                html: html
            });

            return createJsonResponse(200, { message: 'Reminder sent' });

        } catch (error) {
            context.error('Error sending reminder:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
