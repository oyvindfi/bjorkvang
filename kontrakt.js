const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') 
    ? 'http://127.0.0.1:7071/api' 
    : 'https://bjorkvang-duhsaxahgfe0btgv.westeurope-01.azurewebsites.net/api';

// Helper to get query params
const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
};

// Format currency
const formatCurrency = (amount) => {
    if (!amount) return 'Etter avtale';
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);
};

// Format date
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// Calculate price based on rooms (simple logic for now, ideally comes from backend)
const calculatePrice = (rooms, type) => {
    let price = 0;
    if (!rooms) return 0;
    
    const roomList = Array.isArray(rooms) ? rooms : [rooms];
    
    if (roomList.includes('Hele lokalet')) price = 4000;
    else {
        if (roomList.includes('Salen')) price += 3000;
        if (roomList.includes('Peisestue')) price += 1500;
    }

    // Override for weddings
    if (type === 'Bryllup') price = 6000;
    
    return price;
};

// Load contract data
const loadContract = async () => {
    const id = getQueryParam('id');
    if (!id) {
        document.body.innerHTML = '<div style="text-align:center; margin-top:50px;"><h1>Ugyldig lenke</h1><p>Mangler booking-ID.</p></div>';
        return;
    }

    try {
        // In a real scenario, we would fetch from API
        // const response = await fetch(`${API_BASE}/getBooking?id=${id}`);
        // if (!response.ok) throw new Error('Fant ikke booking');
        // const booking = await response.json();

        // MOCK DATA FOR ITERATION 1 (Until backend endpoint is ready)
        // We will try to fetch, if it fails (404/500), we show error.
        // But since we haven't deployed the backend function yet, let's simulate or try.
        
        const response = await fetch(`${API_BASE}/getBooking?id=${id}`);
        
        if (!response.ok) {
            // Fallback for demo purposes if backend isn't ready or returns 404
            console.warn('Backend fetch failed, showing error state');
            throw new Error('Kunne ikke hente avtale. Vennligst prøv igjen senere.');
        }

        const booking = await response.json();

        // Populate fields
        // Use the full ID or a cleaner format if available. 
        // If the ID is "booking-123...", we can just show that, or strip the prefix.
        const displayId = booking.id.replace('booking-', '').toUpperCase();
        document.getElementById('contract-id').textContent = displayId;

        document.getElementById('renter-name').textContent = booking.name;
        document.getElementById('renter-email').textContent = booking.email;
        document.getElementById('renter-phone').textContent = booking.phone;
        
        document.getElementById('rental-date').textContent = formatDate(booking.date);
        document.getElementById('rental-time').textContent = `${booking.time} (${booking.duration} timer)`;
        document.getElementById('rental-rooms').textContent = Array.isArray(booking.spaces) ? booking.spaces.join(', ') : booking.spaces;
        document.getElementById('rental-type').textContent = booking.eventType;

        // Price calculation (if not in booking object, calculate it)
        const price = booking.price || calculatePrice(booking.spaces, booking.eventType);
        document.getElementById('rental-price').textContent = formatCurrency(price);

        // Check if already signed
        if (booking.contract && booking.contract.signedAt) {
            showSignedState(booking.contract.signedAt);
        } else {
            // Setup checkbox listener only if not signed
            const checkbox = document.getElementById('payment-confirm');
            const btn = document.getElementById('btn-sign');
            if (checkbox && btn) {
                checkbox.addEventListener('change', (e) => {
                    btn.disabled = !e.target.checked;
                    btn.style.opacity = e.target.checked ? '1' : '0.5';
                    btn.style.cursor = e.target.checked ? 'pointer' : 'not-allowed';
                });
            }
        }

        document.getElementById('loading').style.display = 'none';

    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: red; font-weight: bold;">Feil: ${error.message}</p>
                <p>Sjekk at backend kjører (func start) og at URL-en er riktig.</p>
                <button onclick="location.reload()" class="button">Prøv igjen</button>
            </div>
        `;
    }
};

const showSignedState = (date) => {
    const area = document.getElementById('signature-area');
    area.classList.add('signed');
    const signedDate = new Date(date).toLocaleString('nb-NO');
    area.innerHTML = `
        <div class="signed-stamp">
            <span>✓</span> Signert digitalt
        </div>
        <p>Signert av leietaker: ${signedDate}</p>
        <p>IP-adresse loggført.</p>
        <button class="button secondary" onclick="window.print()">Last ned / Skriv ut</button>
    `;
};

const signContract = async () => {
    const id = getQueryParam('id');
    const btn = document.querySelector('.btn-sign');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = 'Signerer...';

    try {
        // Call backend to sign
        const response = await fetch(`${API_BASE}/signBooking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        if (!response.ok) throw new Error('Signering feilet');

        const result = await response.json();
        showSignedState(result.signedAt);
        
        alert('Takk! Avtalen er nå signert.');

    } catch (error) {
        alert('Noe gikk galt under signering. Prøv igjen.');
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', loadContract);
