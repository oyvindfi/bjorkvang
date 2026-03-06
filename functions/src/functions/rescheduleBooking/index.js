const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createJsonResponse, parseBody } = require('../../../shared/http');
const { getBooking, updateBookingFields } = require('../../../shared/cosmosDb');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

const MAX_REBOOKS = 1;

app.http('rescheduleBooking', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/reschedule',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        try {
            const body = await parseBody(request);
            const { id, newDate, newTime } = body;

            if (!id || !newDate || !newTime) {
                return createJsonResponse(400, { error: 'Mangler id, newDate eller newTime.' });
            }

            // Basic date format validation (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                return createJsonResponse(400, { error: 'Ugyldig datoformat. Bruk YYYY-MM-DD.' });
            }

            const booking = await getBooking(id);
            if (!booking) {
                return createJsonResponse(404, { error: 'Booking ikke funnet.' });
            }

            if (booking.status !== 'approved') {
                return createJsonResponse(400, { error: 'Ombooking er kun mulig for godkjente bookinger.' });
            }

            const rescheduleCount = booking.rescheduleCount || 0;
            if (rescheduleCount >= MAX_REBOOKS) {
                return createJsonResponse(409, {
                    error: `Maksimalt ${MAX_REBOOKS} ombooking(er) per bestilling er nådd (jf. vilkår §5).`
                });
            }

            const previousDate = booking.date;
            const previousTime = booking.time;

            const updated = await updateBookingFields(id, booking.bjorkvang, {
                date: newDate,
                time: newTime,
                rescheduleCount: rescheduleCount + 1,
                lastRescheduledAt: new Date().toISOString(),
                previousDate,
                previousTime,
            });

            if (!updated) {
                return createJsonResponse(500, { error: 'Kunne ikke oppdatere booking.' });
            }

            context.info(`rescheduleBooking: Booking ${id} flyttet fra ${previousDate} ${previousTime} til ${newDate} ${newTime}`);

            // Format dates for email
            const formatDate = (d) => {
                const date = new Date(d + 'T00:00:00');
                return date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            };

            const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (m) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[m]);

            const safeName = escapeHtml(booking.requesterName);
            const websiteUrl = process.env.WEBSITE_URL || 'https://bjørkvang.no';
            const contractLink = `${websiteUrl}/leieavtale.html?id=${booking.id}`;

            const htmlContent = `
                <p>Hei ${safeName},</p>
                <p>Vi bekrefter at din booking på <strong>Bjørkvang forsamlingslokale</strong> er blitt flyttet til en ny dato:</p>
                <table style="width:100%; border-collapse:collapse; margin: 16px 0; font-size: 0.95em;">
                    <tr>
                        <td style="padding:8px 12px; background:#f9fafb; border:1px solid #e5e7eb; color:#6b7280; width:40%;">Tidligere dato</td>
                        <td style="padding:8px 12px; border:1px solid #e5e7eb; text-decoration:line-through; color:#9ca3af;">${escapeHtml(formatDate(previousDate))} kl. ${escapeHtml(previousTime)}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 12px; background:#f9fafb; border:1px solid #e5e7eb; font-weight:600;">Ny dato</td>
                        <td style="padding:8px 12px; border:1px solid #e5e7eb; font-weight:700; color:#1a823b;">${escapeHtml(formatDate(newDate))} kl. ${escapeHtml(newTime)}</td>
                    </tr>
                </table>
                <p>Alle andre detaljer ved din booking forblir uendret. Merk at ombooking kun er tillatt én gang per bestilling i henhold til våre vilkår.</p>
                <p>Har du spørsmål, ta gjerne kontakt med oss på <a href="tel:+4748060273">+47 480 60 273</a> eller <a href="mailto:styret@bjørkvang.no">styret@bjørkvang.no</a>.</p>
                <p>Med vennlig hilsen,<br><strong>Helgøens Vel</strong></p>
            `;

            const html = generateEmailHtml({
                title: 'Booking flyttet – ny dato bekreftet',
                content: htmlContent,
                action: { text: 'Se din leieavtale', url: contractLink },
                previewText: `Din booking er flyttet til ${formatDate(newDate)} kl. ${newTime}.`,
            });

            const from = process.env.DEFAULT_FROM_ADDRESS;
            if (from && booking.requesterEmail) {
                await sendEmail({
                    to: booking.requesterEmail,
                    from,
                    subject: `Booking flyttet – ny dato ${formatDate(newDate)}`,
                    html,
                });

                // Also notify board
                const boardTo = process.env.BOARD_TO_ADDRESS;
                if (boardTo) {
                    await sendEmail({
                        to: boardTo,
                        from,
                        subject: `[Admin] Booking ${id} ombooket: ${previousDate} → ${newDate}`,
                        html: `<p>Booking <strong>${id}</strong> (${escapeHtml(booking.requesterName)}) er ombooket fra ${previousDate} til ${newDate} ${newTime}.</p>`,
                    });
                }
            }

            return createJsonResponse(200, {
                message: 'Booking ombooket og bekreftelse sendt.',
                booking: updated,
            });

        } catch (error) {
            context.error('rescheduleBooking error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    },
});
