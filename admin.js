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
        const response = await fetch(`${API_BASE_URL}/booking/admin`);
        if (!response.ok) throw new Error('Failed to fetch bookings');
        
        const data = await response.json();
        renderDashboard(data.bookings || []);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Kunne ikke laste bookinger. Sjekk konsollen for detaljer.');
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

    // Sort bookings: Pending first, then by date
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
            // Rejected or past approved
            historyList.appendChild(card);
        }
    });

    if (pendingList.children.length === 0) pendingList.innerHTML = '<p>Ingen bookinger venter på godkjenning.</p>';
    if (upcomingList.children.length === 0) upcomingList.innerHTML = '<p>Ingen kommende bookinger.</p>';
    if (historyList.children.length === 0) historyList.innerHTML = '<p>Ingen historikk.</p>';

    // Update stats
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-upcoming').textContent = upcomingCount;
    document.getElementById('stat-total').textContent = totalYearCount;
}

function createBookingCard(booking) {
    const div = document.createElement('div');
    div.className = `booking-card ${booking.status}`;
    
    const spaces = Array.isArray(booking.spaces) ? booking.spaces.join(', ') : booking.spaces;
    const services = Array.isArray(booking.services) ? booking.services.join(', ') : booking.services;
    
    // Check signature status
    const contract = booking.contract || {};
    const isRequesterSigned = !!contract.signedAt;
    const isLandlordSigned = !!contract.landlordSignedAt;
    const depositPaid = !!booking.depositPaid;
    const invoiceSent = !!booking.invoiceSentAt;
    
    let signatureBadge = '';
    let depositBadge = '';
    
    if (booking.status === 'approved') {
        if (isLandlordSigned) {
            signatureBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">✓ Ferdig signert</span>`;
        } else if (isRequesterSigned) {
            signatureBadge = `<span style="background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">✎ Signert av leietaker</span>`;
        } else {
            signatureBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">⚠ Venter på signering</span>`;
        }
        depositBadge = depositPaid
            ? `<span style="background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">💰 Depositum betalt</span>`
            : `<span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">⚠ Depositum ikke registrert</span>`;
    }

    // Format created date
    let createdStr = 'Ukjent';
    if (booking.createdAt) {
        const createdDate = new Date(booking.createdAt);
        createdStr = createdDate.toLocaleString('nb-NO', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    div.innerHTML = `
        <div class="booking-details">
            <h3>${booking.eventType || 'Reservasjon'} – ${formatDate(booking.date)} ${signatureBadge} ${depositBadge}</h3>
            <div class="booking-meta"><strong>Tid:</strong> ${booking.time} (${booking.duration} timer)</div>
            <div class="booking-meta"><strong>Navn:</strong> ${booking.requesterName}</div>
            <div class="booking-meta"><strong>E-post:</strong> <a href="mailto:${booking.requesterEmail}">${booking.requesterEmail}</a></div>
            <div class="booking-meta"><strong>Tlf:</strong> ${booking.phone || '-'}</div>
            <div class="booking-meta"><strong>Areal:</strong> ${spaces || 'Ikke spesifisert'}</div>
            ${services ? `<div class="booking-meta"><strong>Tillegg:</strong> ${services}</div>` : ''}
            ${booking.attendees ? `<div class="booking-meta"><strong>Antall:</strong> ${booking.attendees}</div>` : ''}
            ${booking.depositAmount ? `<div class="booking-meta"><strong>Depositum:</strong> ${booking.depositAmount.toLocaleString('nb-NO')} kr &nbsp;|&nbsp; <strong>Totalt:</strong> ${(booking.totalAmount || booking.depositAmount * 2).toLocaleString('nb-NO')} kr &nbsp;|&nbsp; <strong>Restbeløp:</strong> ${((booking.totalAmount || booking.depositAmount * 2) - booking.depositAmount).toLocaleString('nb-NO')} kr</div>` : ''}
            ${booking.message ? `<div class="booking-meta" style="margin-top:5px; font-style:italic;">"${booking.message}"</div>` : ''}
            <div class="booking-meta" style="margin-top:5px; font-size:0.8rem; color:#999;">
                Sendt inn: ${createdStr}<br>
                ID: ${booking.id} | Status: ${translateStatus(booking.status)}
            </div>
            ${isRequesterSigned ? `<div class="booking-meta" style="color:#1e40af; font-size:0.8rem;">Leietaker signerte: ${new Date(contract.signedAt).toLocaleString('nb-NO')}</div>` : ''}
            ${isLandlordSigned ? `<div class="booking-meta" style="color:#059669; font-size:0.8rem;">Utleier signerte: ${new Date(contract.landlordSignedAt).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.invoiceSentAt ? `<div class="booking-meta" style="color:#059669; font-size:0.8rem;">📧 Sluttfaktura sendt: ${new Date(booking.invoiceSentAt).toLocaleString('nb-NO')}</div>` : ''}
            ${booking.previousDate ? `<div class="booking-meta" style="color:#6366f1; font-size:0.8rem;">↺ Ombooket fra: ${booking.previousDate}${booking.previousTime ? ' kl. ' + booking.previousTime : ''}</div>` : ''}
        </div>
        <div class="booking-actions">
            ${booking.status === 'pending' ? `
                <button onclick="approveBooking('${booking.id}')" class="btn-sm btn-approve">Godkjenn</button>
                <button onclick="rejectBooking('${booking.id}')" class="btn-sm btn-reject">Avvis</button>
            ` : ''}
            ${booking.status === 'approved' ? `
                <button onclick="rejectBooking('${booking.id}')" class="btn-sm btn-reject">Kanseller</button>
                <button onclick="openContract('${booking.id}')" class="btn-sm" style="background:${isLandlordSigned ? '#10b981' : '#3b82f6'};">
                    ${isLandlordSigned ? 'Se avtale' : (isRequesterSigned ? 'Signer som utleier' : 'Kopier lenke')}
                </button>
                <button onclick="printContract('${booking.id}')" class="btn-sm" style="background:#64748b;" title="Åpner utskriftsvennlig versjon – for telefonbooking og papirskjema">🖨 Skriv ut avtale</button>
                ${!depositPaid ? `<button onclick="markDepositPaid('${booking.id}')" class="btn-sm" style="background:#0ea5e9;">💰 Depositum mottatt</button>` : ''}
                ${!invoiceSent ? `<button onclick="sendInvoice('${booking.id}')" class="btn-sm" style="background:#8b5cf6;" title="Send sluttfaktura med restbeløp til leietaker">📧 Send sluttfaktura</button>` : ''}
                <button onclick="sendReminder('${booking.id}')" class="btn-sm" style="background:#f59e0b; color:black;">Påminnelse</button>
                ${(booking.rescheduleCount || 0) < 1
                    ? `<button onclick="openRescheduleModal('${booking.id}', '${booking.date}', '${(booking.time || '').replace(/'/g, '')}', ${booking.rescheduleCount || 0})" class="btn-sm" style="background:#6366f1;" title="Flytt bookingen til ny dato (maks 1 gang iht. vilkår §5)">📅 Endre dato</button>`
                    : `<span style="font-size:0.78rem; color:#9ca3af; padding:4px 6px; display:inline-block;" title="Maks antall ombookinger er brukt (iht. vilkår §5)">↺ Ombooket (1/1)</span>`
                }
            ` : ''}
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
