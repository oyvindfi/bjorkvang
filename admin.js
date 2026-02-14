const API_BASE_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
    ? 'http://localhost:7071/api' 
    : 'https://bjorkvang-duhsaxahgfe0btgv.westeurope-01.azurewebsites.net/api';

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
    
    let signatureBadge = '';
    
    if (booking.status === 'approved') {
        if (isLandlordSigned) {
            signatureBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">✓ Ferdig signert</span>`;
        } else if (isRequesterSigned) {
            signatureBadge = `<span style="background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">✎ Signert av leietaker</span>`;
        } else {
            signatureBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-left:5px;">⚠ Venter på signering</span>`;
        }
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
            <h3>${booking.eventType || 'Reservasjon'} – ${formatDate(booking.date)} ${signatureBadge}</h3>
            <div class="booking-meta"><strong>Tid:</strong> ${booking.time} (${booking.duration} timer)</div>
            <div class="booking-meta"><strong>Navn:</strong> ${booking.requesterName}</div>
            <div class="booking-meta"><strong>E-post:</strong> <a href="mailto:${booking.requesterEmail}">${booking.requesterEmail}</a></div>
            <div class="booking-meta"><strong>Tlf:</strong> ${booking.phone || '-'}</div>
            <div class="booking-meta"><strong>Areal:</strong> ${spaces || 'Ikke spesifisert'}</div>
            ${services ? `<div class="booking-meta"><strong>Tillegg:</strong> ${services}</div>` : ''}
            ${booking.attendees ? `<div class="booking-meta"><strong>Antall:</strong> ${booking.attendees}</div>` : ''}
            ${booking.message ? `<div class="booking-meta" style="margin-top:5px; font-style:italic;">"${booking.message}"</div>` : ''}
            <div class="booking-meta" style="margin-top:5px; font-size:0.8rem; color:#999;">
                Sendt inn: ${createdStr}<br>
                ID: ${booking.id} | Status: ${translateStatus(booking.status)}
            </div>
            ${isRequesterSigned ? `<div class="booking-meta" style="color:#1e40af; font-size:0.8rem;">Leietaker signerte: ${new Date(contract.signedAt).toLocaleString('nb-NO')}</div>` : ''}
            ${isLandlordSigned ? `<div class="booking-meta" style="color:#059669; font-size:0.8rem;">Utleier signerte: ${new Date(contract.landlordSignedAt).toLocaleString('nb-NO')}</div>` : ''}
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
                <button onclick="sendReminder('${booking.id}')" class="btn-sm" style="background:#f59e0b; color:black;">Påminnelse</button>
            ` : ''}
        </div>
    `;
    return div;
}

function openContract(id) {
    const link = window.location.origin + '/leieavtale?id=' + id + '&mode=admin';
    // If requester has signed, open it directly for admin to sign
    // If not, copy link for admin to send (or open to check)
    // For simplicity, we'll just open it in a new tab if signed, or copy if not.
    // But the button text changes, so let's check the button text or just do both?
    // Let's just open it.
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
