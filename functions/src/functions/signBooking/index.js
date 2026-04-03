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
                                <li>Gå til leieavtalen og signer som utleier (krever innlogging)</li>
                                <li>Send depositumsforespørsel til leietaker</li>
                            </ol>
                            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;">
                                <a href="${escapeHtml(contractLink)}" style="display:inline-block;padding:12px 24px;background:#1a6fa3;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">&#128394; Signer som utleier</a>
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

            // If both have signed, send final agreement + payment request
            if (bothSigned) {
                context.info(`Both signatures complete for ${id}, sending final agreement email`);

                const websiteUrl = (process.env.WEBSITE_URL || 'https://xn--bjrkvang-64a.no').replace(/\/$/, '');
                const contractLink = `${websiteUrl}/leieavtale.html?id=${encodeURIComponent(id)}`;
                const fromAddr = process.env.DEFAULT_FROM_ADDRESS || 'styret@xn--bjrkvang-64a.no';

                const escHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[m]);

                const safeName = escHtml(updatedBooking.requesterName);
                const safeDate = escHtml(updatedBooking.date);
                const safeEventType = escHtml(updatedBooking.eventType || 'Reservasjon');
                const safeSpaces = escHtml(Array.isArray(updatedBooking.spaces) ? updatedBooking.spaces.join(', ') : (updatedBooking.spaces || ''));

                // Payment block (only if not already paid)
                let paymentSection = '';
                let paymentText = '';
                if (updatedBooking.paymentStatus !== 'paid') {
                    const paymentLink = `${websiteUrl}/complete-payment.html?bookingId=${encodeURIComponent(id)}`;
                    paymentSection = `
                        <h3 style="margin:24px 0 8px;font-size:1rem;">Neste steg: Betal depositum</h3>
                        <p>Depositum m&aring; betales f&oslash;r arrangementsdato for at bookingen skal v&aelig;re aktiv.</p>
                        <div style="text-align:center;margin:20px 0;">
                            <a href="${paymentLink}" style="display:inline-block;padding:14px 36px;background:#ff5b24;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:1.05rem;">Betal med Vipps</a>
                        </div>`;
                    paymentText = `\n\nNeste steg – Betal depositum:\n${paymentLink}`;
                }

                try {
                    // Send to tenant
                    const tenantHtml = generateEmailHtml({
                        title: 'Leieavtalen er ferdig signert',
                        content: `
                            <p>Hei ${safeName},</p>
                            <p>Leieavtalen for din booking er n&aring; signert av begge parter. &#127881;</p>
                            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Dato</td><td style="padding:8px 0;text-align:right;font-weight:600;">${safeDate}</td></tr>
                                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Form&aring;l</td><td style="padding:8px 0;text-align:right;">${safeEventType}</td></tr>
                                <tr><td style="padding:8px 0;color:#6b7280;">Lokale</td><td style="padding:8px 0;text-align:right;">${safeSpaces}</td></tr>
                            </table>
                            <p>Du kan n&aring; se og laste ned den ferdig signerte avtalen:</p>
                            <div style="text-align:center;margin:20px 0;">
                                <a href="${escHtml(contractLink)}" style="display:inline-block;padding:14px 36px;background:#1a6fa3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:1.05rem;">&#128196; Se og last ned leieavtalen</a>
                            </div>
                            ${paymentSection}
                            <p style="font-size:0.9rem;color:#6b7280;margin-top:24px;">Sp&oslash;rsm&aring;l? Ta kontakt p&aring; <a href="mailto:styret@bj&oslash;rkvang.no" style="color:#1a6fa3;">styret@bj&oslash;rkvang.no</a>.</p>
                        `,
                        action: { text: 'Se og last ned leieavtalen', url: contractLink },
                        previewText: `Leieavtalen for ${updatedBooking.date} er ferdig signert – last ned her`
                    });

                    await sendEmail({
                        to: updatedBooking.requesterEmail,
                        from: fromAddr,
                        subject: `Leieavtale ferdig signert – ${updatedBooking.date}`,
                        html: tenantHtml,
                        text: `Hei ${updatedBooking.requesterName},\n\nLeieavtalen for din booking ${updatedBooking.date} (${updatedBooking.eventType || 'Reservasjon'}) er nå signert av begge parter.\n\nSe og last ned avtalen: ${contractLink}${paymentText}`
                    });

                    context.info(`Final agreement email sent to ${updatedBooking.requesterEmail}`);

                    // Also notify board
                    const boardTo = process.env.BOARD_TO_ADDRESS || process.env.DEFAULT_TO_ADDRESS;
                    if (boardTo) {
                        const adminLink = `${websiteUrl}/admin#${encodeURIComponent(id)}`;
                        const boardHtml = generateEmailHtml({
                            title: 'Leieavtale ferdig signert av begge parter',
                            content: `
                                <p>Leieavtalen for <strong>${safeName}</strong> (${safeDate}, ${safeEventType}) er n&aring; signert av begge parter.</p>
                                ${updatedBooking.paymentStatus !== 'paid' ? '<p>Depositum er enn&aring; ikke betalt.</p>' : '<p style="color:#166534;"><strong>&check; Depositum er betalt.</strong></p>'}
                                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;">
                                    <a href="${escHtml(contractLink)}" style="display:inline-block;padding:12px 24px;background:#1a6fa3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">&#128196; Se leieavtalen</a>
                                    <a href="${escHtml(adminLink)}" style="display:inline-block;padding:12px 24px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">&Aring;pne i admin</a>
                                </div>
                            `,
                            previewText: `Leieavtalen for ${updatedBooking.date} er ferdig signert`
                        });

                        await sendEmail({
                            to: boardTo,
                            from: fromAddr,
                            subject: `Leieavtale ferdig signert: ${updatedBooking.requesterName} – ${updatedBooking.date}`,
                            html: boardHtml,
                            text: `Leieavtalen for ${updatedBooking.requesterName} (${updatedBooking.date}) er signert av begge parter.\n\nSe avtalen: ${contractLink}\nAdmin: ${adminLink}`
                        });
                    }
                } catch (emailError) {
                    context.error(`Failed to send final agreement email: ${emailError.message}`);
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
