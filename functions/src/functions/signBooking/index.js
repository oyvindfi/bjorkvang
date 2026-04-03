const { app } = require('@azure/functions');
const { addContractSignature, getBooking } = require('../../../shared/cosmosDb');
const { createJsonResponse } = require('../../../shared/http');
const { sendEmail } = require('../../../shared/email');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

app.http('signBooking', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { id, role, signatureData, signerName } = body;

            if (!id) {
                return createJsonResponse(400, { message: 'Missing booking ID' }, request);
            }

            // Capture metadata for the signature
            const signatureMetadata = {
                role: role || 'requester', // Default to requester for backward compatibility
                signatureData: signatureData, // { type: 'draw'|'text', data: '...' }
                signerName: signerName, // Printed name
                signedAt: new Date().toISOString(),
                userAgent: request.headers.get('user-agent') || 'Unknown',
                ipAddress: request.headers.get('x-forwarded-for') || 'Unknown'
            };

            // Add the signature
            const updatedBooking = await addContractSignature(id, null, signatureMetadata);

            if (!updatedBooking) {
                return createJsonResponse(404, { message: 'Booking not found' }, request);
            }

            // Check if both parties have now signed
            const contract = updatedBooking.contract || {};
            const bothSigned = contract.signedAt && contract.landlordSignedAt;

            context.info(`Signature added for booking ${id}, role: ${role}, both signed: ${bothSigned}`);

            // Notify board when tenant signs
            if ((role || 'requester') === 'requester') {
                try {
                    const boardTo = process.env.BOARD_TO_ADDRESS || process.env.DEFAULT_TO_ADDRESS;
                    const fromAddr = process.env.DEFAULT_FROM_ADDRESS || 'styret@xn--bjrkvang-64a.no';
                    const websiteUrl = (process.env.WEBSITE_URL || 'https://xn--bjrkvang-64a.no').replace(/\/$/, '');
                    const contractLink = `${websiteUrl}/leieavtale.html?id=${encodeURIComponent(id)}`;
                    const adminLink = `${websiteUrl}/admin#${encodeURIComponent(id)}`;

                    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                    })[m]);

                    const safeName = escapeHtml(updatedBooking.requesterName);
                    const safeDate = escapeHtml(updatedBooking.date);
                    const safeEventType = escapeHtml(updatedBooking.eventType || 'Reservasjon');

                    const notifyHtml = generateEmailHtml({
                        title: 'Leieavtale signert av leietaker',
                        content: `
                            <p><strong>${safeName}</strong> har signert leieavtalen for sin booking.</p>
                            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Dato</td><td style="padding:8px 0;text-align:right;font-weight:600;">${safeDate}</td></tr>
                                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Formål</td><td style="padding:8px 0;text-align:right;">${safeEventType}</td></tr>
                                <tr><td style="padding:8px 0;color:#6b7280;">Lokale</td><td style="padding:8px 0;text-align:right;">${escapeHtml(Array.isArray(updatedBooking.spaces) ? updatedBooking.spaces.join(', ') : (updatedBooking.spaces || ''))}</td></tr>
                            </table>
                            <p style="margin-top:24px;"><strong>Neste steg:</strong></p>
                            <ol style="color:#374151;">
                                <li>Signer avtalen som utleier</li>
                                <li>Send depositumsforespørsel til leietaker</li>
                            </ol>
                            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;">
                                <a href="${escapeHtml(contractLink)}" style="display:inline-block;padding:12px 24px;background:#1a6fa3;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Åpne leieavtalen</a>
                                <a href="${escapeHtml(adminLink)}" style="display:inline-block;padding:12px 24px;background:#6b7280;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Åpne i admin</a>
                            </div>
                        `,
                        previewText: `${updatedBooking.requesterName} har signert leieavtalen for ${updatedBooking.date}`
                    });

                    if (boardTo) {
                        await sendEmail({
                            to: boardTo,
                            from: fromAddr,
                            subject: `Leieavtale signert: ${updatedBooking.requesterName} – ${updatedBooking.date}`,
                            html: notifyHtml,
                            text: `${updatedBooking.requesterName} har signert leieavtalen for booking ${updatedBooking.date} (${updatedBooking.eventType || 'Reservasjon'}).\n\nÅpne leieavtalen: ${contractLink}\nÅpne i admin: ${adminLink}\n\nNeste steg: Signer som utleier og send depositumsforespørsel.`
                        });
                        context.info(`Board notification sent for tenant signature on ${id}`);
                    } else {
                        context.warn('No BOARD_TO_ADDRESS configured, skipping tenant signature notification');
                    }
                } catch (notifyError) {
                    context.error(`Failed to send board notification for tenant signature: ${notifyError.message}`);
                }
            }

            // If both have signed AND payment is not yet completed
            if (bothSigned && updatedBooking.paymentStatus !== 'paid') {
                context.info(`Both signatures complete for ${id}, sending payment request email`);

                try {
                    // Send payment request email to tenant
                    const paymentLink = `${process.env.WEBSITE_URL || 'https://bjørkvang.no'}/complete-payment.html?bookingId=${id}`;

                    const emailHtml = generateEmailHtml({
                        title: 'Fullfør betaling for booking',
                        content: `
                            <p>Hei ${updatedBooking.requesterName},</p>
                            <p>Gratulerer! Leieavtalen for booking <strong>${id.replace('booking-', '').toUpperCase()}</strong> er nå signert av begge parter.</p>
                            <p><strong>Neste steg:</strong> Fullfør betalingen for å aktivere bookingen.</p>
                            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                                <p style="margin: 0 0 10px 0;"><strong>Bookingdetaljer:</strong></p>
                                <ul style="margin: 0; padding-left: 20px;">
                                    <li>Dato: ${updatedBooking.date}</li>
                                    <li>Lokaler: ${Array.isArray(updatedBooking.spaces) ? updatedBooking.spaces.join(', ') : updatedBooking.spaces}</li>
                                    <li>Beløp: ${updatedBooking.paymentAmount ? (updatedBooking.paymentAmount / 100).toLocaleString('nb-NO') + ' kr' : 'Se faktura'}</li>
                                </ul>
                            </div>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="${paymentLink}" style="display: inline-block; padding: 15px 40px; background: #ff5b24; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem;">
                                    <span style="background: white; color: #ff5b24; padding: 2px 8px; border-radius: 4px; margin-right: 8px; font-weight: 900; font-style: italic;">V</span>
                                    Betal med Vipps
                                </a>
                            </p>
                            <p style="font-size: 0.9rem; color: #666;">Betalingen må gjennomføres før arrangementsdato for at bookingen skal være aktiv.</p>
                        `,
                        previewText: 'Fullfør betaling for din booking'
                    });

                    await sendEmail({
                        to: updatedBooking.requesterEmail,
                        from: process.env.DEFAULT_FROM_ADDRESS || 'styret@bjørkvang.no',
                        subject: 'Fullfør betaling for din booking',
                        html: emailHtml,
                        text: `Hei ${updatedBooking.requesterName},\n\nLeieavtalen er signert! Fullfør betalingen her: ${paymentLink}`
                    });

                    context.info(`Payment request email sent to ${updatedBooking.requesterEmail}`);
                } catch (emailError) {
                    context.error(`Failed to send payment email: ${emailError.message}`);
                    // Don't fail the request if email fails
                }
            }

            // Return the signature details
            return createJsonResponse(200, {
                message: 'Contract signed successfully',
                signedAt: signatureMetadata.signedAt,
                bothSigned: bothSigned,
                paymentRequired: bothSigned && updatedBooking.paymentStatus !== 'paid'
            }, request);

        } catch (error) {
            context.error(`Error signing booking:`, error);
            return createJsonResponse(500, { message: 'Internal server error' }, request);
        }
    }
});
