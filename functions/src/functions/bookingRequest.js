const { app } = require('@azure/functions');
const { sendEmail } = require('../../shared/email');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../shared/http');
const { saveBooking } = require('../../shared/cosmosDb');
const { generateEmailHtml } = require('../../shared/emailTemplate');

/**
 * Handle incoming booking submissions from the public website.
 * Stores the booking and notifies the board for approval using the Plunk SMTP setup.
 */
app.http('bookingRequest', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            context.log('bookingRequest: Handled CORS preflight');
            return createJsonResponse(204);
        }

        const body = await parseBody(request);
        const { date, time, requesterName, requesterEmail, message, duration, eventType, spaces, services, attendees } = body;

        // Validate required fields
        if (!date || !time || !requesterName || !requesterEmail) {
            context.warn('bookingRequest: Missing required fields', { 
                hasDate: Boolean(date),
                hasTime: Boolean(time),
                hasName: Boolean(requesterName),
                hasEmail: Boolean(requesterEmail)
            });
            return createJsonResponse(400, { error: 'Missing one of required fields: date, time, requesterName, requesterEmail.' });
        }
        
        // Validate field types and formats
        if (typeof date !== 'string' || typeof time !== 'string' || 
            typeof requesterName !== 'string' || typeof requesterEmail !== 'string') {
            context.warn('bookingRequest: Invalid field types');
            return createJsonResponse(400, { error: 'Invalid field types.' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(requesterEmail.trim())) {
            context.warn('bookingRequest: Invalid email format', { email: requesterEmail });
            return createJsonResponse(400, { error: 'Invalid email format.' });
        }
        
        // Validate and sanitize inputs
        const trimmedDate = date.trim();
        const trimmedTime = time.trim();
        const trimmedName = requesterName.trim();
        const trimmedEmail = requesterEmail.trim();
        const trimmedMessage = message ? String(message).trim() : '';
        const trimmedEventType = eventType ? String(eventType).trim() : 'Reservasjon';
        const safeDuration = Number(duration) || 4;
        const safeAttendees = Number(attendees) || 0;
        const safeSpaces = Array.isArray(spaces) ? spaces : (spaces ? [String(spaces)] : []);
        const safeServices = Array.isArray(services) ? services : (services ? [String(services)] : []);
        
        // Length validation
        if (trimmedName.length > 100) {
            context.warn('bookingRequest: Name too long');
            return createJsonResponse(400, { error: 'Name must be less than 100 characters.' });
        }
        
        if (trimmedMessage.length > 2000) {
            context.warn('bookingRequest: Message too long');
            return createJsonResponse(400, { error: 'Message must be less than 2000 characters.' });
        }
        
        // Date format validation (basic ISO date check)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
            context.warn('bookingRequest: Invalid date format', { date: trimmedDate });
            return createJsonResponse(400, { error: 'Invalid date format. Expected YYYY-MM-DD.' });
        }

        // Validate that booking is not too far in the future (max 2 years)
        const bookingDateObj = new Date(trimmedDate);
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 2);
        
        if (bookingDateObj > maxDate) {
            context.warn('bookingRequest: Date too far in future', { date: trimmedDate });
            return createJsonResponse(400, { error: 'Bookings can only be made up to 2 years in advance.' });
        }
        
        // Time format validation (HH:MM)
        if (!/^\d{2}:\d{2}$/.test(trimmedTime)) {
            context.warn('bookingRequest: Invalid time format', { time: trimmedTime });
            return createJsonResponse(400, { error: 'Invalid time format. Expected HH:MM.' });
        }

        context.info('bookingRequest: Validation passed, attempting to save booking...');

        try {
            // Generate unique booking ID
            const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            context.info(`bookingRequest: Generated ID ${bookingId}, calling saveBooking...`);

            // Create booking with sanitized inputs
            const booking = await saveBooking({ 
                id: bookingId,
                date: trimmedDate, 
                time: trimmedTime, 
                requesterName: trimmedName, 
                requesterEmail: trimmedEmail, 
                message: trimmedMessage,
                eventType: trimmedEventType,
                duration: safeDuration,
                attendees: safeAttendees,
                spaces: safeSpaces,
                services: safeServices,
                status: 'pending'
            });
            
            context.info('bookingRequest: Created booking', {
                id: booking.id,
                date: booking.date,
                email: booking.requesterEmail
            });
            
            const baseUrl = resolveBaseUrl(request);
            const approveLink = `${baseUrl}/api/booking/approve?id=${encodeURIComponent(booking.id)}`;
            const rejectLink = `${baseUrl}/api/booking/reject?id=${encodeURIComponent(booking.id)}`;

            const to = process.env.BOARD_TO_ADDRESS || process.env.DEFAULT_TO_ADDRESS || 'skype.oyvind@hotmail.com';
            let from = process.env.DEFAULT_FROM_ADDRESS || 'styret@xn--bjrkvang-64a.no';

            if (!to || !from) {
                context.error('bookingRequest: Missing email configuration', { 
                    hasTo: Boolean(to), 
                    hasFrom: Boolean(from) 
                });
                return createJsonResponse(500, { error: 'Email configuration missing. Please contact an administrator.' });
            }
            
            // Escape HTML to prevent XSS
            const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[m]);
            
            const safeName = escapeHtml(booking.requesterName);
            const safeEmail = escapeHtml(booking.requesterEmail);
            const safeDate = escapeHtml(booking.date);
            const safeTime = escapeHtml(booking.time);
            const safeMessage = escapeHtml(booking.message || 'Ingen melding oppgitt.');
            const safeEventType = escapeHtml(booking.eventType);
            const safeSpacesStr = escapeHtml(booking.spaces.join(', ') || 'Ingen valgt');
            const safeServicesStr = escapeHtml(booking.services.join(', ') || 'Ingen valgt');

            // --- Board Notification Email ---
            const boardHtmlContent = `
                <p>Det har kommet en ny bookingforespørsel som venter på godkjenning.</p>
                <ul class="info-list">
                    <li><span class="info-label">Dato</span> <span class="info-value">${safeDate}</span></li>
                    <li><span class="info-label">Tid</span> <span class="info-value">${safeTime}</span></li>
                    <li><span class="info-label">Type</span> <span class="info-value">${safeEventType}</span></li>
                    <li><span class="info-label">Varighet</span> <span class="info-value">${booking.duration} timer</span></li>
                    <li><span class="info-label">Navn</span> <span class="info-value">${safeName}</span></li>
                    <li><span class="info-label">E-post</span> <span class="info-value">${safeEmail}</span></li>
                    <li><span class="info-label">Arealer</span> <span class="info-value">${safeSpacesStr}</span></li>
                    <li><span class="info-label">Tjenester</span> <span class="info-value">${safeServicesStr}</span></li>
                    <li><span class="info-label">Antall</span> <span class="info-value">${booking.attendees || 'Ikke oppgitt'}</span></li>
                </ul>
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 16px;">
                    <strong>Melding:</strong><br>
                    ${safeMessage}
                </div>
                <p style="margin-top: 24px;">Bruk knappene under for å behandle forespørselen:</p>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <a href="${escapeHtml(approveLink)}" style="display:inline-block;padding:10px 20px;background:#1a823b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Godkjenn booking</a>
                    <a href="${escapeHtml(rejectLink)}" style="display:inline-block;padding:10px 20px;background:#b91c1c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Avvis booking</a>
                </div>
            `;

            const boardHtml = generateEmailHtml({
                title: 'Ny bookingforespørsel',
                content: boardHtmlContent,
                previewText: `Ny forespørsel fra ${safeName} for ${safeDate}`
            });

            const text = `Ny bookingforespørsel:\nDato: ${booking.date}\nTid: ${booking.time}\nType: ${booking.eventType}\nNavn: ${booking.requesterName}\nE-post: ${booking.requesterEmail}\nMelding: ${booking.message || 'Ingen melding'}\nGodkjenn: ${approveLink}\nAvvis: ${rejectLink}`;

            await sendEmail({
                to,
                from,
                subject: `Ny bookingforespørsel: ${booking.eventType} – ${booking.date}`,
                text,
                html: boardHtml,
            });
            
            context.info('bookingRequest: Board notification email sent');

            // --- Requester Confirmation Email ---
            const confirmationSubject = 'Vi har mottatt bookingforespørselen din';
            
            const confirmationHtmlContent = `
                <p>Hei ${safeName},</p>
                <p>Takk for din forespørsel om å booke Bjørkvang. Vi har mottatt følgende detaljer:</p>
                <ul class="info-list">
                    <li><span class="info-label">Dato</span> <span class="info-value">${safeDate}</span></li>
                    <li><span class="info-label">Tid</span> <span class="info-value">${safeTime}</span></li>
                    <li><span class="info-label">Type</span> <span class="info-value">${safeEventType}</span></li>
                    <li><span class="info-label">Arealer</span> <span class="info-value">${safeSpacesStr}</span></li>
                </ul>
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 16px;">
                    <strong>Din melding:</strong><br>
                    ${safeMessage}
                </div>
                <p style="margin-top: 24px;"><strong>Hva skjer nå?</strong><br>
                Styret vil se gjennom forespørselen din. Du vil motta en e-post så snart bookingen er behandlet (vanligvis innen 2-3 dager).</p>
            `;

            const confirmationHtml = generateEmailHtml({
                title: 'Forespørsel mottatt',
                content: confirmationHtmlContent,
                previewText: 'Takk for din forespørsel om å booke Bjørkvang.'
            });

            const confirmationText = `Hei ${booking.requesterName},\n\nTakk for din forespørsel om å booke Bjørkvang.\n\nOppsummering av forespørselen:\n- Dato: ${booking.date}\n- Tid: ${booking.time}\n- Type: ${booking.eventType}\n- Melding: ${booking.message || 'Ingen melding oppgitt.'}\n\nStyret vil ta kontakt med deg så snart som mulig.\n\nVennlig hilsen\nBjørkvang`;

            try {
                await sendEmail({
                    to: booking.requesterEmail,
                    from,
                    subject: confirmationSubject,
                    text: confirmationText,
                    html: confirmationHtml,
                });
                context.info('bookingRequest: Confirmation email sent to requester');
            } catch (error) {
                context.error('bookingRequest: Failed to send confirmation email to requester', {
                    error: error.message,
                    stack: error.stack,
                    bookingId: booking.id
                });
            }

            context.info(`bookingRequest: Successfully processed booking ${booking.id}`);
            return createJsonResponse(202, {
                id: booking.id,
                status: booking.status,
            });
        } catch (error) {
            context.error('bookingRequest: Failed to process booking request', {
                error: error.message,
                stack: error.stack,
                body: { date, time, requesterName, hasEmail: Boolean(requesterEmail) }
            });
            
            // Provide user-friendly error message
            // DEBUG: Exposing full error for troubleshooting
            const userMessage = error.message || 'Unable to process booking right now.';
                
            return createJsonResponse(500, { error: userMessage, details: error.stack });
        }
    },
});
