const API_BASE_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
    ? 'http://localhost:7071/api' 
    : 'https://bjorkvang-duhsaxahgfe0btgv.westeurope-01.azurewebsites.net/api';

// ---------- Reschedule modal ----------

function injectRescheduleModal() {
    if (document.getElementById('reschedule-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'reschedule-modal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9000; align-items:center; justify-content:center;';
    modal.innerHTML = `
        <div style="background:#fff; border-radius:10px; padding:2rem; max-width:420px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="margin:0 0 0.25rem; font-size:1.2rem;">Endre dato for booking</h3>
            <p id="reschedule-current" style="color:#6b7280; font-size:0.9rem; margin:0 0 1.25rem;"></p>
            <p id="reschedule-limit-warning" style="display:none; color:#b45309; font-size:0.85rem; background:#fef3c7; border:1px solid #fbbf24; border-radius:6px; padding:0.6rem 0.85rem; margin-bottom:1rem;">
                ⚠ Merk: Dette er siste tillatte ombooking for denne bestillingen (maks 1 gang iht. vilkår §5).
            </p>
            <label style="display:block; font-weight:600; margin-bottom:0.4rem;">Ny dato</label>
            <input id="reschedule-date" type="date" style="width:100%; padding:0.55rem; border:1px solid #d1d5db; border-radius:6px; font-size:1rem; margin-bottom:1rem; box-sizing:border-box;" />
            <label style="display:block; font-weight:600; margin-bottom:0.4rem;">Nytt tidspunkt</label>
            <input id="reschedule-time" type="time" style="width:100%; padding:0.55rem; border:1px solid #d1d5db; border-radius:6px; font-size:1rem; margin-bottom:1.5rem; box-sizing:border-box;" />
            <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                <button onclick="closeRescheduleModal()" style="padding:0.55rem 1.2rem; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; font-size:0.95rem;">Avbryt</button>
                <button id="reschedule-confirm-btn" onclick="confirmReschedule()" style="padding:0.55rem 1.4rem; border:none; border-radius:6px; background:#3b82f6; color:#fff; font-weight:600; cursor:pointer; font-size:0.95rem;">Bekreft flytt</button>
            </div>
            <p id="reschedule-error" style="display:none; color:#ef4444; font-size:0.85rem; margin-top:0.75rem;"></p>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeRescheduleModal(); });
    document.body.appendChild(modal);
}

let _rescheduleBookingId = null;

function openRescheduleModal(id, currentDate, currentTime, rescheduleCount) {
    injectRescheduleModal();
    _rescheduleBookingId = id;
    document.getElementById('reschedule-current').textContent =
        `Nåværende dato: ${currentDate} kl. ${currentTime}`;
    document.getElementById('reschedule-date').value = currentDate;
    document.getElementById('reschedule-time').value = currentTime || '12:00';
    document.getElementById('reschedule-error').style.display = 'none';
    // Warn if this will be the last allowed rebook
    const warning = document.getElementById('reschedule-limit-warning');
    warning.style.display = (rescheduleCount === 0) ? 'block' : 'none';
    const modal = document.getElementById('reschedule-modal');
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('reschedule-date').focus(), 50);
}

function closeRescheduleModal() {
    const modal = document.getElementById('reschedule-modal');
    if (modal) modal.style.display = 'none';
    _rescheduleBookingId = null;
}

async function confirmReschedule() {
    const newDate = document.getElementById('reschedule-date').value;
    const newTime = document.getElementById('reschedule-time').value;
    const errorEl = document.getElementById('reschedule-error');
    const btn = document.getElementById('reschedule-confirm-btn');

    if (!newDate || !newTime) {
        errorEl.textContent = 'Du må fylle inn både dato og tidspunkt.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Lagrer...';
    errorEl.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE_URL}/booking/reschedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: _rescheduleBookingId, newDate, newTime }),
        });

        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.error || 'Noe gikk galt.';
            errorEl.style.display = 'block';
            return;
        }

        closeRescheduleModal();
        alert(`✓ Booking flyttet til ${newDate} kl. ${newTime}. Bekreftelse er sendt til leietaker.`);
        loadDashboard();
    } catch (err) {
        console.error('confirmReschedule error:', err);
        errorEl.textContent = 'Nettverksfeil. Prøv igjen.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Bekreft flytt';
    }
}

async function checkLogin() {
    const input = document.getElementById('password-input').value;
    const btn = document.querySelector('#login-overlay button');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = 'Sjekker...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: input })
        });

        if (response.ok) {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            sessionStorage.setItem('admin_auth', 'true');
            loadDashboard();
        } else {
            if (response.status === 404) {
                alert('Kunne ikke kontakte serveren (404). Er funksjonene deployet?');
            } else if (response.status === 401) {
                alert('Feil passord');
            } else {
                alert(`Noe gikk galt (Status: ${response.status})`);
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Kunne ikke logge inn. Sjekk nettverkstilkoblingen.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function logout() {
    sessionStorage.removeItem('admin_auth');
    location.reload();
}

// Check session on load
if (sessionStorage.getItem('admin_auth') === 'true') {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDashboard();
}

async function loadDashboard() {
    try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 20000); // 20s timeout
        let response;
        try {
            response = await fetch(`${API_BASE_URL}/booking/admin`, { signal: ctrl.signal });
        } finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(`Server svarte ${response.status}: ${errBody.error || response.statusText}`);
        }
        const data = await response.json();
        let bookings = data.bookings || [];

        // Auto-check Vipps payment statuses on every dashboard load
        try {
            const vippsRes = await fetch(`${API_BASE_URL}/booking/check-vipps-statuses`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            if (vippsRes.ok) {
                const vippsData = await vippsRes.json();
                // Use the fresh booking list returned by the status check
                if (Array.isArray(vippsData.bookings) && vippsData.bookings.length > 0) {
                    bookings = vippsData.bookings;
                }
                if (vippsData.updatedCount > 0) {
                    console.info(`Vipps status check: ${vippsData.updatedCount} booking(s) updated.`);
                }
            }
        } catch (vippsErr) {
            console.warn('Vipps status check failed (non-fatal):', vippsErr);
        }

        renderDashboard(bookings);
    } catch (error) {
        const msg = error.name === 'AbortError'
            ? 'Forespørselen tok for lang tid (>20s) — sannsynligvis timeout mot Cosmos DB. Sjekk Azure Portal.'
            : (error.message || 'Ukjent feil');
        console.error('Error loading dashboard:', msg, error);
        document.getElementById('pending-list').innerHTML = `<p style="color:#ef4444;">⚠ Feil: ${msg}</p>`;
        alert('Kunne ikke laste bookinger: ' + msg);
    }
}

function renderDashboard(bookings) {
    const pendingList = document.getElementById('pending-list');
    const upcomingList = document.getElementById('upcoming-list');
    const historyList = document.getElementById('history-list');
    
    pendingList.innerHTML = '';
    upcomingList.innerHTML = '';
    historyList.innerHTML = '';

    const now = new Date();
    const currentYear = now.getFullYear();

    bookings.sort((a, b) => new Date(a.date) - new Date(b.date));

    let pendingCount = 0;
    let upcomingCount = 0;
    let totalYearCount = 0;

    bookings.forEach(booking => {
        const bookingDate = new Date(booking.date);
        const isPast = bookingDate < new Date(now.setHours(0,0,0,0));
        
        if (bookingDate.getFullYear() === currentYear) {
            totalYearCount++;
        }

        const card = createBookingCard(booking);

        if (booking.status === 'pending') {
            pendingCount++;
            pendingList.appendChild(card);
        } else if (booking.status === 'approved' && !isPast) {
            upcomingCount++;
            upcomingList.appendChild(card);
        } else {
            historyList.appendChild(card);
        }
    });

    if (pendingList.children.length === 0) pendingList.innerHTML = '<p>Ingen bookinger venter på godkjenning.</p>';
    if (upcomingList.children.length === 0) upcomingList.innerHTML = '<p>Ingen kommende bookinger.</p>';
    if (historyList.children.length === 0) historyList.innerHTML = '<p>Ingen historikk.</p>';

    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-upcoming').textContent = upcomingCount;
    document.getElementById('stat-total').textContent = totalYearCount;

    renderVippsDashboard(bookings);

    // Scroll to and highlight booking from URL hash (e.g. /admin#booking-123)
    const hashId = decodeURIComponent(window.location.hash.slice(1));
    if (hashId) {
        const target = document.querySelector(`[data-booking-id="${CSS.escape(hashId)}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.outline = '3px solid #1a6fa3';
            target.style.boxShadow = '0 0 0 6px rgba(26,111,163,0.15)';
            setTimeout(() => { target.style.outline = ''; target.style.boxShadow = ''; }, 4000);
        }
    }
}

function createBookingCard(booking) {
    const div = document.createElement('div');
    div.className = `booking-card ${booking.status}`;
    div.setAttribute('data-booking-id', booking.id);
    
    const spaces = Array.isArray(booking.spaces) ? booking.spaces.join(', ') : booking.spaces;
    const services = Array.isArray(booking.services) ? booking.services.join(', ') : booking.services;
    
    const contract = booking.contract || {};
    const isRequesterSigned = !!contract.signedAt;
    const isLandlordSigned = !!contract.landlordSignedAt;

    // --- Payment state ---
    const depositRequested = !!booking.depositRequested;
    const depositPaid = !!booking.depositPaid;
    const depositViaVipps = !!booking.depositVippsOrderId;
    const finalInvoiceSent = !!(booking.finalInvoiceSentAt || booking.invoiceSentAt);
    const finalInvoicePaid = !!booking.finalInvoicePaid;
    const finalViaVipps = !!booking.finalInvoiceVippsOrderId;
    const paymentMethod = booking.paymentMethod || 'bank';
    const totalNOK = booking.totalAmount || 0;
    const depositNOK = booking.depositAmount || (totalNOK ? Math.round(totalNOK * 0.5) : 0);

    // --- Signature badge ---
    let signatureBadge = '';
    if (booking.status === 'approved') {
        if (isLandlordSigned) {
            signatureBadge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:0.8rem;margin-left:5px;">✓ Ferdig signert</span>`;
        } else if (isRequesterSigned) {
            signatureBadge = `<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:0.8rem;margin-left:5px;">✎ Signert av leietaker</span>`;
        } else {
            signatureBadge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:0.8rem;margin-left:5px;">⚠ Venter på signering</span>`;
        }
    }

    // --- Deposit/invoice status badges ---
    let paymentBadges = '';
    if (booking.status === 'approved') {
        if (!depositRequested) {
            paymentBadges += `<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;font-size:0.8rem;margin-left:5px;">💰 Depositum ikke sendt</span>`;
        } else if (depositRequested && !depositPaid) {
            const sentDate = booking.depositRequestedAt ? new Date(booking.depositRequestedAt).toLocaleDateString('nb-NO') : '';
            const method = depositViaVipps ? '(Vipps)' : '(bank)';
            paymentBadges += `<span style="background:#e0f2fe;color:#075985;padding:2px 7px;border-radius:4px;font-size:0.8rem;margin-left:5px;">⏳ Depositum sendt ${sentDate} ${method}</span>`;
        } else if (depositPaid) {
            paymentBadges += `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:4px;font-size:0.8rem;margin-left:5px;">✅ Depositum betalt${depositNOK ? ' kr ' + depositNOK.toLocaleString('nb-NO') : ''}</span>`;
        }

        if (depositPaid) {
            if (!finalInvoiceSent) {
                paymentBadges += `<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;font-size:0.8rem;margin-left:5px;">📄 Sluttfaktura ikke sendt</span>`;
            } else if (finalInvoiceSent && !finalInvoicePaid) {
                const method = finalViaVipps ? '(Vipps)' : '(bank)';
                paymentBadges += `<span style="background:#e0f2fe;color:#075985;padding:2px 7px;border-radius:4px;font-size:0.8rem;margin-left:5px;">⏳ Sluttfaktura sendt ${method}</span>`;
            } else if (finalInvoicePaid) {
                paymentBadges += `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:4px;font-size:0.8rem;margin-left:5px;">✅ Sluttfaktura betalt</span>`;
            }
        }
    }

    let createdStr = 'Ukjent';
    if (booking.createdAt) {
        createdStr = new Date(booking.createdAt).toLocaleString('nb-NO', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    // --- Action buttons for approved bookings ---
    let approvedActions = '';
    if (booking.status === 'approved') {
        approvedActions += `<button onclick="rejectBooking('${booking.id}')" class="btn-sm btn-reject">Kanseller</button>`;
        approvedActions += `<button onclick="openContract('${booking.id}')" class="btn-sm" style="background:${isLandlordSigned ? '#10b981' : '#3b82f6'};">
            ${isLandlordSigned ? 'Se avtale' : (isRequesterSigned ? 'Signer som utleier' : 'Kopier lenke')}
        </button>`;
        approvedActions += `<button onclick="printContract('${booking.id}')" class="btn-sm" style="background:#64748b;" title="Åpner utskriftsvennlig versjon">🖨 Skriv ut avtale</button>`;

        // Deposit flow
        if (!depositRequested) {
            approvedActions += `<button onclick="sendDepositRequest('${booking.id}')" class="btn-sm" style="background:#0ea5e9;">💸 Send depositumforespørsel</button>`;
        } else if (depositRequested && !depositPaid) {
            if (paymentMethod === 'bank') {
                // For bank: allow admin to manually mark as paid
                approvedActions += `<button onclick="markDepositPaid('${booking.id}')" class="btn-sm" style="background:#0ea5e9;">💰 Depositum mottatt (bank)</button>`;
            }
            // For Vipps: auto-checked on load, but also allow manual mark as fallback
            if (paymentMethod === 'vipps') {
                approvedActions += `<button onclick="markDepositPaid('${booking.id}')" class="btn-sm" style="background:#64748b;font-size:0.75rem;">🔄 Merk depositum betalt (manuelt)</button>`;
            }
        }

        // Final invoice — only available after deposit is paid
        if (depositPaid && !finalInvoiceSent) {
            approvedActions += `<button onclick="openFinalInvoiceModal('${booking.id}', ${totalNOK}, ${depositNOK})" class="btn-sm" style="background:#8b5cf6;">📧 Send sluttfaktura</button>`;
        } else if (finalInvoiceSent && !finalInvoicePaid && paymentMethod === 'bank') {
            approvedActions += `<button onclick="markFinalInvoicePaid('${booking.id}')" class="btn-sm" style="background:#0ea5e9;">✅ Sluttfaktura betalt (bank)</button>`;
        }

        approvedActions += `<button onclick="sendReminder('${booking.id}')" class="btn-sm" style="background:#f59e0b;color:black;">Påminnelse</button>`;

        if ((booking.rescheduleCount || 0) < 1) {
            approvedActions += `<button onclick="openRescheduleModal('${booking.id}', '${booking.date}', '${(booking.time || '').replace(/'/g, '')}', ${booking.rescheduleCount || 0})" class="btn-sm" style="background:#6366f1;" title="Flytt bookingen til ny dato (maks 1 gang iht. vilkår §5)">📅 Endre dato</button>`;
        } else {
            approvedActions += `<span style="font-size:0.78rem;color:#9ca3af;padding:4px 6px;display:inline-block;" title="Maks antall ombookinger er brukt (iht. vilkår §5)">↺ Ombooket (1/1)</span>`;
        }
    }

    div.innerHTML = `
        <div class="booking-details">
            <h3>${booking.eventType || 'Reservasjon'} – ${formatDate(booking.date)} ${signatureBadge} ${paymentBadges}</h3>
            <div class="booking-meta"><strong>Tid:</strong> ${booking.time} (${booking.duration} timer)</div>
            <div class="booking-meta"><strong>Navn:</strong> ${booking.requesterName}</div>
            <div class="booking-meta"><strong>E-post:</strong> <a href="mailto:${booking.requesterEmail}">${booking.requesterEmail}</a></div>
            <div class="booking-meta"><strong>Tlf:</strong> ${booking.phone || '-'}</div>
            <div class="booking-meta"><strong>Areal:</strong> ${spaces || 'Ikke spesifisert'}</div>
            ${services ? `<div class="booking-meta"><strong>Tillegg:</strong> ${services}</div>` : ''}
            ${booking.attendees ? `<div class="booking-meta"><strong>Antall:</strong> ${booking.attendees}</div>` : ''}
            <div class="booking-meta"><strong>Betalingsmetode:</strong> ${paymentMethod === 'vipps' ? 'Vipps' : 'Bank'}</div>
            ${totalNOK ? `<div class="booking-meta"><strong>Estimert total:</strong> kr ${totalNOK.toLocaleString('nb-NO')} &nbsp;|&nbsp; <strong>Depositum (50%):</strong> kr ${depositNOK.toLocaleString('nb-NO')} &nbsp;|&nbsp; <strong>Restbeløp:</strong> kr ${(totalNOK - depositNOK).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.message ? `<div class="booking-meta" style="margin-top:5px;font-style:italic;">"${booking.message}"</div>` : ''}
            <div class="booking-meta" style="margin-top:5px;font-size:0.8rem;color:#999;">
                Sendt inn: ${createdStr}<br>
                ID: ${booking.id} | Status: ${translateStatus(booking.status)}
            </div>
            ${isRequesterSigned ? `<div class="booking-meta" style="color:#1e40af;font-size:0.8rem;">Leietaker signerte: ${new Date(contract.signedAt).toLocaleString('nb-NO')}</div>` : ''}
            ${isLandlordSigned ? `<div class="booking-meta" style="color:#059669;font-size:0.8rem;">Utleier signerte: ${new Date(contract.landlordSignedAt).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.depositRequestedAt ? `<div class="booking-meta" style="color:#075985;font-size:0.8rem;">💸 Depositumforespørsel sendt: ${new Date(booking.depositRequestedAt).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.depositPaidAt ? `<div class="booking-meta" style="color:#059669;font-size:0.8rem;">✅ Depositum betalt: ${new Date(booking.depositPaidAt).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.finalInvoiceSentAt ? `<div class="booking-meta" style="color:#059669;font-size:0.8rem;">📧 Sluttfaktura sendt: ${new Date(booking.finalInvoiceSentAt).toLocaleString('nb-NO')}</div>` : booking.invoiceSentAt ? `<div class="booking-meta" style="color:#059669;font-size:0.8rem;">📧 Sluttfaktura sendt: ${new Date(booking.invoiceSentAt).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.previousDate ? `<div class="booking-meta" style="color:#6366f1;font-size:0.8rem;">↺ Ombooket fra: ${booking.previousDate}${booking.previousTime ? ' kl. ' + booking.previousTime : ''}</div>` : ''}
        </div>
        <div class="booking-actions">
            ${booking.status === 'pending' ? `
                <button onclick="approveBooking('${booking.id}')" class="btn-sm btn-approve">Godkjenn</button>
                <button onclick="rejectBooking('${booking.id}')" class="btn-sm btn-reject">Avvis</button>
            ` : ''}
            ${approvedActions}
        </div>
    `;
    return div;
}

function openContract(id) {
    const link = window.location.origin + '/leieavtale?id=' + id + '&mode=admin';
    window.open(link, '_blank');
}

function printContract(id) {
    const link = window.location.origin + '/leieavtale?id=' + id + '&print=1';
    window.open(link, '_blank');
}

function copyContractLink(id) {
    const link = window.location.origin + '/leieavtale?id=' + id;
    navigator.clipboard.writeText(link).then(() => alert('Lenke kopiert!'));
}

async function sendReminder(id) {
    const comment = prompt('Vil du legge til en kommentar i påminnelsen? (Valgfritt)');
    if (comment === null) return; // Cancelled

    try {
        const response = await fetch(`${API_BASE_URL}/booking/remind`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ id, comment })
        });
        
        if (response.ok) {
            alert('Påminnelse sendt!');
        } else {
            alert('Noe gikk galt. Prøv igjen.');
        }
    } catch (error) {
        console.error(error);
        alert('Feil ved kommunikasjon med server.');
    }
}

async function markDepositPaid(id) {
    if (!confirm('Bekreft at depositum er mottatt for denne bookingen?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/booking/deposit-paid?id=${id}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            alert('Depositum markert som betalt!');
            loadDashboard();
        } else {
            alert('Noe gikk galt. Prøv igjen.');
        }
    } catch (error) {
        console.error(error);
        alert('Nettverksfeil.');
    }
}

async function sendDepositRequest(id) {
    if (!confirm('Send depositumforespørsel til leietaker?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/booking/send-deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const method = data.paymentMethod === 'vipps' ? 'Vipps-lenke' : 'bankdetaljer';
            alert(`Depositumforespørsel sendt til ${data.sentTo} (${method}, kr ${(data.depositAmount || 0).toLocaleString('nb-NO')})!`);
            loadDashboard();
        } else {
            alert(`Feil: ${data.error || 'Kunne ikke sende depositumforespørsel.'}`);
        }
    } catch (err) {
        console.error(err);
        alert('Nettverksfeil.');
    }
}

// ---------- Final invoice modal ----------

let _finalInvoiceBookingId = null;
let _finalInvoiceTotalNOK = 0;
let _finalInvoiceDepositNOK = 0;
let _extraItemCount = 0;

function openFinalInvoiceModal(id, totalNOK, depositNOK) {
    _finalInvoiceBookingId = id;
    _finalInvoiceTotalNOK = totalNOK || 0;
    _finalInvoiceDepositNOK = depositNOK || 0;
    _extraItemCount = 0;

    injectFinalInvoiceModal();

    document.getElementById('fi-base-total').textContent = totalNOK ? `kr ${totalNOK.toLocaleString('nb-NO')}` : '–';
    document.getElementById('fi-deposit').textContent = depositNOK ? `− kr ${depositNOK.toLocaleString('nb-NO')}` : '–';
    document.getElementById('fi-extra-rows').innerHTML = '';
    updateFinalInvoiceTotal();

    document.getElementById('final-invoice-modal').style.display = 'flex';
}

function injectFinalInvoiceModal() {
    if (document.getElementById('final-invoice-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'final-invoice-modal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9000; align-items:flex-start; justify-content:center; padding:40px 16px; overflow-y:auto;';
    modal.innerHTML = `
        <div style="background:#fff; border-radius:10px; padding:2rem; max-width:560px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="margin:0 0 1rem; font-size:1.2rem;">📧 Send sluttfaktura</h3>

            <table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-bottom:1rem;">
                <tr>
                    <td style="padding:6px 0;color:#6b7280;">Leiesum (estimert total)</td>
                    <td id="fi-base-total" style="text-align:right;font-weight:600;">–</td>
                </tr>
                <tr id="fi-extra-rows"></tr>
                <tr>
                    <td style="padding:6px 0;color:#059669;">Depositum allerede betalt (trekkes fra)</td>
                    <td id="fi-deposit" style="text-align:right;color:#059669;">–</td>
                </tr>
                <tr style="border-top:2px solid #e5e7eb;">
                    <td style="padding:10px 0;font-weight:bold;font-size:1.05rem;">Gjenstående å betale</td>
                    <td id="fi-remaining" style="text-align:right;font-weight:bold;font-size:1.05rem;">–</td>
                </tr>
            </table>

            <div style="margin-bottom:1rem;">
                <strong style="font-size:0.9rem;">Tilleggsbelastninger (f.eks. vask, ekstra utstyr)</strong>
                <div id="fi-extra-items-container" style="margin-top:8px;"></div>
                <button type="button" onclick="addExtraInvoiceItem()" style="margin-top:8px;padding:5px 12px;border:1px dashed #9ca3af;border-radius:6px;background:transparent;cursor:pointer;font-size:0.88rem;color:#6b7280;">+ Legg til rad</button>
            </div>

            <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.25rem;">
                <button onclick="closeFinalInvoiceModal()" style="padding:0.55rem 1.2rem; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; font-size:0.95rem;">Avbryt</button>
                <button id="fi-submit-btn" onclick="submitFinalInvoice()" style="padding:0.55rem 1.4rem; border:none; border-radius:6px; background:#8b5cf6; color:#fff; font-weight:600; cursor:pointer; font-size:0.95rem;">Send sluttfaktura</button>
            </div>
            <p id="fi-error" style="display:none; color:#ef4444; font-size:0.85rem; margin-top:0.75rem;"></p>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFinalInvoiceModal(); });
    document.body.appendChild(modal);
}

function addExtraInvoiceItem() {
    const container = document.getElementById('fi-extra-items-container');
    const rowId = `fi-extra-${_extraItemCount++}`;
    const row = document.createElement('div');
    row.id = rowId;
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
    row.innerHTML = `
        <input type="text" placeholder="Beskrivelse (f.eks. Vask)" oninput="updateFinalInvoiceTotal()"
            style="flex:1;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font:inherit;font-size:0.9rem;"
            class="fi-desc">
        <input type="number" placeholder="kr" min="0" step="1" oninput="updateFinalInvoiceTotal()"
            style="width:90px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font:inherit;font-size:0.9rem;"
            class="fi-amount">
        <button type="button" onclick="document.getElementById('${rowId}').remove(); updateFinalInvoiceTotal();"
            style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:1.1rem;padding:0 4px;">✕</button>
    `;
    container.appendChild(row);
}

function updateFinalInvoiceTotal() {
    const extraRows = document.querySelectorAll('#fi-extra-items-container > div');
    let extrasTotal = 0;
    extraRows.forEach(row => {
        const amt = parseFloat(row.querySelector('.fi-amount')?.value) || 0;
        extrasTotal += amt;
    });
    const remaining = (_finalInvoiceTotalNOK - _finalInvoiceDepositNOK) + extrasTotal;
    const el = document.getElementById('fi-remaining');
    if (el) el.textContent = `kr ${remaining.toLocaleString('nb-NO')}`;
}

function closeFinalInvoiceModal() {
    const modal = document.getElementById('final-invoice-modal');
    if (modal) modal.style.display = 'none';
    _finalInvoiceBookingId = null;
}

async function submitFinalInvoice() {
    const btn = document.getElementById('fi-submit-btn');
    const errEl = document.getElementById('fi-error');
    errEl.style.display = 'none';

    // Collect extra items
    const extraItems = [];
    const extraRows = document.querySelectorAll('#fi-extra-items-container > div');
    for (const row of extraRows) {
        const desc = (row.querySelector('.fi-desc')?.value || '').trim();
        const amt = parseFloat(row.querySelector('.fi-amount')?.value) || 0;
        if (desc || amt) {
            if (!desc) { errEl.textContent = 'Fyll inn beskrivelse for alle tilleggsrader.'; errEl.style.display = 'block'; return; }
            if (amt < 0) { errEl.textContent = 'Beløp kan ikke være negativt.'; errEl.style.display = 'block'; return; }
            extraItems.push({ description: desc, amountNOK: amt });
        }
    }

    btn.disabled = true;
    btn.textContent = 'Sender...';

    try {
        const res = await fetch(`${API_BASE_URL}/booking/send-final-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: _finalInvoiceBookingId, extraItems })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            closeFinalInvoiceModal();
            alert(`Sluttfaktura sendt til ${data.sentTo}!\nGjenstående beløp: kr ${(data.remainingAmount || 0).toLocaleString('nb-NO')}`);
            loadDashboard();
        } else {
            errEl.textContent = data.error || 'Noe gikk galt.';
            errEl.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        errEl.textContent = 'Nettverksfeil. Prøv igjen.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send sluttfaktura';
    }
}

async function markFinalInvoicePaid(id) {
    if (!confirm('Bekreft at sluttfaktura er betalt (bankoverføring)?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/booking/deposit-paid?id=${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ markFinalInvoice: true })
        });
        if (res.ok) {
            // There's no dedicated endpoint yet — use updateBookingFields approach via a generic patch if available,
            // otherwise fall back to a simple alert instructing the admin.
            alert('Merk: for nå markeres dette manuelt. Kontakt utvikler for å legge til et dedikert endepunkt for sluttfaktura-betaling via bank.');
            loadDashboard();
        } else {
            alert('Noe gikk galt.');
        }
    } catch (err) {
        console.error(err);
        alert('Nettverksfeil.');
    }
}

// ---------- Vipps payment dashboard ----------

function renderVippsDashboard(bookings) {
    const panel = document.getElementById('vipps-dashboard-panel');
    if (!panel) return;

    const vippsBookings = bookings.filter(b =>
        b.paymentMethod === 'vipps' ||
        b.depositVippsOrderId ||
        b.finalInvoiceVippsOrderId
    );

    const stats = {
        depositsSent: vippsBookings.filter(b => b.depositVippsOrderId).length,
        depositsPaid: vippsBookings.filter(b => b.depositPaid && b.depositVippsOrderId).length,
        invoicesSent: vippsBookings.filter(b => b.finalInvoiceVippsOrderId).length,
        invoicesPaid: vippsBookings.filter(b => b.finalInvoicePaid).length,
    };

    const statusBadge = (paid, sent) => {
        if (paid) return '<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:4px;font-size:0.8rem;">✅ Betalt</span>';
        if (sent) return '<span style="background:#e0f2fe;color:#075985;padding:2px 7px;border-radius:4px;font-size:0.8rem;">⏳ Sendt</span>';
        return '<span style="background:#f3f4f6;color:#6b7280;padding:2px 7px;border-radius:4px;font-size:0.8rem;">– Ikke sendt</span>';
    };

    const rows = vippsBookings.map(b => {
        const depNOK = b.depositAmount || 0;
        const invNOK = b.finalInvoiceAmountNOK || 0;
        return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 6px;font-weight:500;">${b.requesterName || '–'}</td>
            <td style="padding:8px 6px;color:#6b7280;">${b.date || '–'}</td>
            <td style="padding:8px 6px;">${b.eventType || '–'}</td>
            <td style="padding:8px 6px;">${statusBadge(b.depositPaid, b.depositVippsOrderId)}${depNOK ? ` <small style="color:#6b7280;">kr ${depNOK.toLocaleString('nb-NO')}</small>` : ''}</td>
            <td style="padding:8px 6px;">${statusBadge(b.finalInvoicePaid, b.finalInvoiceVippsOrderId)}${invNOK ? ` <small style="color:#6b7280;">kr ${invNOK.toLocaleString('nb-NO')}</small>` : ''}</td>
        </tr>`;
    }).join('');

    panel.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:1rem;">
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 20px;min-width:130px;text-align:center;">
                <div style="font-size:1.6rem;font-weight:bold;color:#0369a1;">${stats.depositsSent}</div>
                <div style="font-size:0.8rem;color:#6b7280;">Depositum sendt</div>
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 20px;min-width:130px;text-align:center;">
                <div style="font-size:1.6rem;font-weight:bold;color:#15803d;">${stats.depositsPaid}</div>
                <div style="font-size:0.8rem;color:#6b7280;">Depositum betalt</div>
            </div>
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 20px;min-width:130px;text-align:center;">
                <div style="font-size:1.6rem;font-weight:bold;color:#0369a1;">${stats.invoicesSent}</div>
                <div style="font-size:0.8rem;color:#6b7280;">Sluttfaktura sendt</div>
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 20px;min-width:130px;text-align:center;">
                <div style="font-size:1.6rem;font-weight:bold;color:#15803d;">${stats.invoicesPaid}</div>
                <div style="font-size:0.8rem;color:#6b7280;">Fullt betalt</div>
            </div>
        </div>
        ${vippsBookings.length === 0
            ? '<p style="color:#9ca3af;font-size:0.9rem;">Ingen bookinger med Vipps-betaling ennå.</p>'
            : `<div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead>
                        <tr style="text-align:left;border-bottom:2px solid #e5e7eb;color:#6b7280;font-weight:600;">
                            <th style="padding:6px;">Navn</th>
                            <th style="padding:6px;">Dato</th>
                            <th style="padding:6px;">Arrangement</th>
                            <th style="padding:6px;">Depositum</th>
                            <th style="padding:6px;">Sluttfaktura</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
               </div>`
        }`;
}

async function sendInvoice(id) {
    if (!confirm('Send sluttfaktura med restbeløp til leietaker?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/booking/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (response.ok) {
            alert('Sluttfaktura sendt!');
            loadDashboard();
        } else {
            const data = await response.json().catch(() => ({}));
            alert(`Feil: ${data.error || 'Kunne ikke sende faktura.'}`);
        }
    } catch (error) {
        console.error(error);
        alert('Nettverksfeil.');
    }
}

async function approveBooking(id) {
    if (!confirm('Er du sikker på at du vil godkjenne denne bookingen?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/booking/approve?id=${id}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            alert('Booking godkjent!');
            loadDashboard();
        } else {
            alert('Noe gikk galt. Prøv igjen.');
        }
    } catch (error) {
        console.error(error);
        alert('Feil ved kommunikasjon med server.');
    }
}

async function rejectBooking(id) {
    const reason = prompt('Vennligst oppgi årsak til avvisning/kansellering (sendes til kunden):');
    if (reason === null) return; // Cancelled

    try {
        const response = await fetch(`${API_BASE_URL}/booking/reject?id=${id}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        if (response.ok) {
            alert('Booking avvist/kansellert.');
            loadDashboard();
        } else {
            alert('Noe gikk galt. Prøv igjen.');
        }
    } catch (error) {
        console.error(error);
        alert('Feil ved kommunikasjon med server.');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function translateStatus(status) {
    const map = {
        'pending': 'Venter',
        'approved': 'Godkjent',
        'rejected': 'Avvist'
    };
    return map[status] || status;
}

function toggleHistory() {
    const el = document.getElementById('history-list');
    el.classList.toggle('hidden');
}

function toggleManualBooking() {
    const panel = document.getElementById('manual-booking-panel');
    const icon  = document.getElementById('manual-toggle-icon');
    const isHidden = panel.classList.toggle('hidden');
    icon.textContent = isHidden ? '▼' : '▲';
    if (!isHidden) panel.querySelector('input')?.focus();
}

const MB_WHOLE = ['Hele lokalet', 'Bryllupspakke'];
const MB_INDIVIDUAL = ['Peisestue', 'Salen', 'Små møter'];

function mbEnforceSpace(changed) {
    if (!changed.checked) return;
    const all = document.querySelectorAll('input[name="mb-spaces"]');
    if (MB_WHOLE.includes(changed.value)) {
        all.forEach(cb => { if (cb !== changed) cb.checked = false; });
    } else if (MB_INDIVIDUAL.includes(changed.value)) {
        all.forEach(cb => {
            if (cb !== changed && (MB_WHOLE.includes(cb.value) || MB_INDIVIDUAL.includes(cb.value)))
                cb.checked = false;
        });
    }
}

async function createManualBooking(event) {
    event.preventDefault();
    const statusEl = document.getElementById('mb-status');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    const spaces = Array.from(document.querySelectorAll('input[name="mb-spaces"]:checked')).map(cb => cb.value);
    if (spaces.length === 0) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = 'Velg minst ett lokale.';
        return;
    }

    const services = Array.from(document.querySelectorAll('input[name="mb-services"]:checked')).map(cb => cb.value);

    const payload = {
        requesterName:  document.getElementById('mb-name').value.trim(),
        requesterEmail: document.getElementById('mb-email').value.trim(),
        phone:          document.getElementById('mb-phone').value.trim(),
        date:           document.getElementById('mb-date').value,
        time:           document.getElementById('mb-time').value,
        duration:       parseFloat(document.getElementById('mb-duration').value),
        eventType:      document.getElementById('mb-eventtype').value,
        message:        document.getElementById('mb-message').value.trim(),
        attendees:      parseInt(document.getElementById('mb-attendees').value) || null,
        isMember:       document.getElementById('mb-member').checked,
        spaces,
        services,
        adminCreated:   true,
    };

    submitBtn.disabled = true;
    statusEl.style.color = '#555';
    statusEl.textContent = 'Oppretter booking...';

    try {
        const res = await fetch(`${API_BASE_URL}/booking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            statusEl.style.color = '#ef4444';
            statusEl.textContent = data.message || data.error || 'Noe gikk galt.';
            return;
        }

        // Auto-approve since admin is creating it
        const approveRes = await fetch(`${API_BASE_URL}/booking/approve?id=${encodeURIComponent(data.id)}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });

        if (approveRes.ok) {
            statusEl.style.color = '#059669';
            statusEl.textContent = `✓ Booking opprettet og godkjent (ID: ${data.id})`;
            event.target.reset();
            loadDashboard();
        } else {
            statusEl.style.color = '#f59e0b';
            statusEl.textContent = `Booking opprettet (ID: ${data.id}), men automatisk godkjenning feilet. Godkjenn manuelt i listen.`;
            loadDashboard();
        }
    } catch (err) {
        console.error('createManualBooking failed', err);
        statusEl.style.color = '#ef4444';
        statusEl.textContent = 'Nettverksfeil. Sjekk konsollen.';
    } finally {
        submitBtn.disabled = false;
    }
}
