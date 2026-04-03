const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createHtmlResponse, createJsonResponse, parseBody } = require('../../../shared/http');
const { getBooking, updateBookingStatus } = require('../../../shared/cosmosDb');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

/**
 * Build the admin action page HTML (confirm before rejecting).
 */
function buildRejectPage(booking, actionUrl) {
    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);

    const dateObj = new Date(`${booking.date}T00:00:00`);
    const formattedDate = !isNaN(dateObj)
        ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : booking.date;

    return `<!DOCTYPE html>
<html lang="nb"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avvis booking – Bjørkvang</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#1f2937;line-height:1.6}
.wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.1);overflow:hidden}
.hdr{background:#b91c1c;color:#fff;padding:24px 28px}
.hdr h1{font-size:1.25rem;font-weight:700}
.hdr p{font-size:.85rem;opacity:.8;margin-top:4px}
.body{padding:28px}
table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:.95rem}
td{padding:8px 0;border-bottom:1px solid #e5e7eb}
td:first-child{color:#6b7280}
td:last-child{text-align:right;font-weight:600}
label{display:block;font-weight:600;font-size:.9rem;margin-bottom:6px}
textarea{width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;font-size:.9rem;resize:vertical;min-height:80px}
.hint{font-size:.8rem;color:#9ca3af;margin-top:4px}
.btns{display:flex;gap:12px;margin-top:24px}
.btn{padding:12px 24px;border:none;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;text-decoration:none;text-align:center;flex:1}
.btn-reject{background:#ef4444;color:#fff}
.btn-reject:hover{background:#dc2626}
.btn-cancel{background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db}
.btn-cancel:hover{background:#e5e7eb}
.result{display:none;text-align:center;padding:40px 28px}
.result h2{margin-bottom:8px}
.result.ok h2{color:#059669}
.result.fail h2{color:#dc2626}
.spinner{display:none;margin:0 auto 12px;width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#ef4444;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <h1>Avvis booking</h1>
    <p>Bjørkvang forsamlingslokale – Helgøens Vel</p>
  </div>
  <div class="body" id="form-view">
    <table>
      <tr><td>Dato</td><td>${escapeHtml(formattedDate)}</td></tr>
      <tr><td>Tidspunkt</td><td>kl. ${escapeHtml(booking.time || '')}${booking.duration ? ` (${booking.duration} timer)` : ''}</td></tr>
      <tr><td>Formål</td><td>${escapeHtml(booking.eventType || 'Reservasjon')}</td></tr>
      <tr><td>Lokale</td><td>${escapeHtml(Array.isArray(booking.spaces) ? booking.spaces.join(', ') : (booking.spaces || ''))}</td></tr>
      <tr><td>Navn</td><td>${escapeHtml(booking.requesterName || '')}</td></tr>
      <tr><td>E-post</td><td>${escapeHtml(booking.requesterEmail || '')}</td></tr>
    </table>
    <label for="reason">Årsak til avvisning</label>
    <textarea id="reason" placeholder="F.eks. «Lokalet er dessverre ikke tilgjengelig den datoen pga. vedlikehold.»"></textarea>
    <p class="hint">Årsaken sendes til kunden i avvisnings-e-posten.</p>
    <div class="btns">
      <button class="btn btn-reject" onclick="doReject()">✕ Avvis booking</button>
      <a class="btn btn-cancel" href="javascript:history.back()">Avbryt</a>
    </div>
  </div>
  <div class="result" id="result-view">
    <div class="spinner" id="spinner"></div>
    <h2 id="result-title"></h2>
    <p id="result-text"></p>
  </div>
</div>
<script>
async function doReject(){
  var formEl=document.getElementById('form-view');
  var resultEl=document.getElementById('result-view');
  var spin=document.getElementById('spinner');
  formEl.style.display='none';
  resultEl.style.display='block';
  spin.style.display='block';
  try{
    var res=await fetch('${escapeHtml(actionUrl)}',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({reason:document.getElementById('reason').value})
    });
    spin.style.display='none';
    var data=await res.json();
    if(res.ok){
      resultEl.className='result ok';
      document.getElementById('result-title').textContent='Booking avvist';
      document.getElementById('result-text').textContent='Avvisningsmelding er sendt til leietaker.';
    }else{
      resultEl.className='result fail';
      document.getElementById('result-title').textContent='Noe gikk galt';
      document.getElementById('result-text').textContent=data.error||'Ukjent feil. Prøv igjen.';
    }
  }catch(e){
    spin.style.display='none';
    resultEl.className='result fail';
    document.getElementById('result-title').textContent='Nettverksfeil';
    document.getElementById('result-text').textContent='Kunne ikke nå serveren. Sjekk internettforbindelsen.';
  }
}
</script></body></html>`;
}

/**
 * Reject a booking via link or API call (GET = form, POST = execute).
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
        const isApiRequest = request.headers.get('accept')?.includes('application/json');

        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            context.warn('rejectBooking called with invalid or missing ID');
            return createJsonResponse(400, { error: 'Missing booking id.' }, request);
        }

        const existingBooking = await getBooking(id.trim());
        if (!existingBooking) {
            context.warn(`rejectBooking: Booking not found for ID: ${id}`);
            if (isApiRequest) return createJsonResponse(404, { error: 'Booking not found.' }, request);
            return createHtmlResponse(404, '<p>Bookingen ble ikke funnet.</p>', request);
        }

        if (existingBooking.status === 'rejected') {
            context.info(`rejectBooking: Booking ${id} was already rejected`);
            if (isApiRequest) {
                return createJsonResponse(200, { message: 'Booking was already rejected.' }, request);
            }
            return createHtmlResponse(200, '<p>Booking var allerede avvist. Forespørrer er informert.</p>', request);
        }

        // --- GET: Show rejection form ---
        if (request.method === 'GET') {
            const actionUrl = `${new URL(request.url).origin}/api/booking/reject?id=${encodeURIComponent(id.trim())}`;
            return createHtmlResponse(200, buildRejectPage(existingBooking, actionUrl), request);
        }

        // --- POST: Execute rejection ---
        let rejectionMessage = '';
        const body = await parseBody(request);
        rejectionMessage = (body.reason || '').trim();
        if (rejectionMessage.length > 1000) {
            context.warn('rejectBooking: Rejection message too long, truncating');
            rejectionMessage = rejectionMessage.substring(0, 1000);
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
