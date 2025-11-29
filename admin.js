const API_BASE_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
    ? 'http://localhost:7071/api' 
    : 'https://bjorkvang-duhsaxahgfe0btgv.westeurope-01.azurewebsites.net/api';

// Simple client-side "security" - NOT SECURE, just to hide UI
const ADMIN_PASSWORD = 'bjorkvang-admin'; 

function checkLogin() {
    const input = document.getElementById('password-input').value;
    if (input === ADMIN_PASSWORD) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        sessionStorage.setItem('admin_auth', 'true');
        loadDashboard();
    } else {
        alert('Feil passord');
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
            <h3>${booking.eventType || 'Reservasjon'} – ${formatDate(booking.date)}</h3>
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
        </div>
        <div class="booking-actions">
            ${booking.status === 'pending' ? `
                <button onclick="approveBooking('${booking.id}')" class="btn-sm btn-approve">Godkjenn</button>
                <button onclick="rejectBooking('${booking.id}')" class="btn-sm btn-reject">Avvis</button>
            ` : ''}
            ${booking.status === 'approved' ? `
                <button onclick="rejectBooking('${booking.id}')" class="btn-sm btn-reject">Kanseller</button>
            ` : ''}
        </div>
    `;
    return div;
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
