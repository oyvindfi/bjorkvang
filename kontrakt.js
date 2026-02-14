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

// --- Signature Pad Logic ---
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function initCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Set up canvas style
    ctx.strokeStyle = '#000';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault(); // Prevent scrolling on touch
        
        const rect = canvas.getBoundingClientRect();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
    });
    
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        [lastX, lastY] = [touch.clientX - rect.left, touch.clientY - rect.top];
    });
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', () => isDrawing = false);
}

function clearCanvas(id = 'signature-canvas') {
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearLandlordCanvas() {
    clearCanvas('landlord-signature-canvas');
}

function setSignatureMode(mode) {
    document.getElementById('draw-mode').style.display = mode === 'draw' ? 'block' : 'none';
    document.getElementById('text-mode').style.display = mode === 'text' ? 'block' : 'none';
    
    document.querySelectorAll('#signature-pad-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function setLandlordSignatureMode(mode) {
    document.getElementById('landlord-draw-mode').style.display = mode === 'draw' ? 'block' : 'none';
    document.getElementById('landlord-text-mode').style.display = mode === 'text' ? 'block' : 'none';
    
    document.querySelectorAll('#landlord-signature-pad-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function getSignatureData(canvasId, inputId) {
    const canvas = document.getElementById(canvasId);
    const input = document.getElementById(inputId);
    
    // Check if canvas has content (simple check: is it blank?)
    // For simplicity, we check which mode is visible
    const isDrawMode = canvas.parentElement.style.display !== 'none';
    
    if (isDrawMode) {
        // Check if canvas is empty (optional, but good)
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) return null;
        return { type: 'draw', data: canvas.toDataURL() };
    } else {
        const text = input.value.trim();
        if (!text) return null;
        return { type: 'text', data: text };
    }
}

// --- Admin Security ---

async function unlockLandlordSigning() {
    const input = document.getElementById('admin-pin-input').value;
    const btn = document.querySelector('#landlord-auth-container button');
    
    if (!input) {
        alert('Vennligst skriv inn kode.');
        return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Verifiserer...';

    try {
        const response = await fetch(`${API_BASE}/admin/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: input })
        });

        if (response.ok) {
            document.getElementById('landlord-auth-container').style.display = 'none';
            document.getElementById('landlord-signature-pad-container').style.display = 'block';
            initCanvas('landlord-signature-canvas');
        } else {
            alert('Feil kode.');
        }
    } catch (error) {
        console.error('Verification error:', error);
        alert('Kunne ikke verifisere kode.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- Main Logic ---

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

        // State Management
        const contract = booking.contract || {};
        
        if (contract.signedAt) {
            // Requester has signed
            showRequesterSignedState(contract);
            
            if (contract.landlordSignedAt) {
                // Landlord has also signed -> Fully Signed
                showLandlordSignedState(contract);
            } else {
                // Waiting for Landlord
                if (getQueryParam('mode') === 'admin') {
                    // Show Landlord Signature Area for signing (Only for admin)
                    document.getElementById('landlord-signature-area').style.display = 'block';
                    // Don't init canvas yet, wait for unlock
                } else {
                    // Show waiting message for regular users
                    showWaitingForLandlordState();
                }
            }
        } else {
            // Not signed by anyone
            // Setup checkbox listener
            const checkbox = document.getElementById('payment-confirm');
            const btn = document.getElementById('btn-sign');
            const sigPad = document.getElementById('signature-pad-container');
            
            if (checkbox && btn) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        sigPad.style.display = 'block';
                        initCanvas('signature-canvas');
                    } else {
                        btn.disabled = true;
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'not-allowed';
                        sigPad.style.display = 'none';
                    }
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

const showRequesterSignedState = (contract) => {
    const area = document.getElementById('signature-area');
    area.classList.add('signed');
    const signedDate = new Date(contract.signedAt).toLocaleString('nb-NO');
    
    let signatureDisplay = '';
    if (contract.requesterSignature) {
        if (contract.requesterSignature.type === 'draw') {
            signatureDisplay = `<img src="${contract.requesterSignature.data}" alt="Signatur" style="max-height: 80px; border-bottom: 1px solid #ccc;">`;
        } else {
            signatureDisplay = `<div style="font-family: 'Dancing Script', cursive; font-size: 2rem; border-bottom: 1px solid #ccc; display: inline-block; padding: 0 20px;">${contract.requesterSignature.data}</div>`;
        }
    }

    const signerName = contract.requesterName || 'Ukjent';

    area.innerHTML = `
        <div class="signed-stamp">
            <span>✓</span> Signert av leietaker
        </div>
        <div style="margin: 20px 0;">
            ${signatureDisplay}
        </div>
        <p style="font-weight: bold; margin-bottom: 5px;">${signerName}</p>
        <p>Dato: ${signedDate}</p>
        <p style="font-size: 0.8rem; color: #888;">IP: ${contract.ipAddress || 'Loggført'}</p>
    `;
};

const showWaitingForLandlordState = () => {
    const area = document.getElementById('landlord-signature-area');
    area.style.display = 'block';
    area.style.background = '#f9f9f9';
    area.style.border = '1px dashed #ccc';
    area.innerHTML = `
        <h3>Utleiers signatur</h3>
        <div style="padding: 20px; text-align: center; color: #666;">
            <p><strong>Venter på signering fra utleier.</strong></p>
            <p style="font-size: 0.9rem;">Avtalen er signert av deg, og vil bli ferdigstilt når utleier har signert.</p>
        </div>
    `;
};

const showLandlordSignedState = (contract) => {
    const area = document.getElementById('landlord-signature-area');
    area.style.display = 'block';
    area.classList.add('signed');
    area.style.background = '#fff';
    area.style.border = '2px solid #10b981'; // Green border like the other one

    const signedDate = new Date(contract.landlordSignedAt).toLocaleString('nb-NO');
    
    let signatureDisplay = '';
    if (contract.landlordSignature) {
        if (contract.landlordSignature.type === 'draw') {
            signatureDisplay = `<img src="${contract.landlordSignature.data}" alt="Signatur" style="max-height: 80px; border-bottom: 1px solid #ccc;">`;
        } else {
            signatureDisplay = `<div style="font-family: 'Dancing Script', cursive; font-size: 2rem; border-bottom: 1px solid #ccc; display: inline-block; padding: 0 20px;">${contract.landlordSignature.data}</div>`;
        }
    }

    const signerName = contract.landlordName || 'Styret';

    area.innerHTML = `
        <div class="signed-stamp">
            <span>✓</span> Signert av utleier
        </div>
        <div style="margin: 20px 0;">
            ${signatureDisplay}
        </div>
        <p style="font-weight: bold; margin-bottom: 5px;">${signerName}</p>
        <p>Dato: ${signedDate}</p>
        <div style="margin-top: 20px;">
            <button class="button secondary" onclick="window.print()">Last ned / Skriv ut</button>
        </div>
    `;
};

const signContract = async () => {
    const id = getQueryParam('id');
    const btn = document.getElementById('btn-sign');
    const nameInput = document.getElementById('signer-name');
    
    // Validate signature
    const signature = getSignatureData('signature-canvas', 'signature-text-input');
    if (!signature) {
        alert('Du må signere (tegne eller skrive navn) før du kan sende inn.');
        return;
    }

    const signerName = nameInput.value.trim();
    if (!signerName) {
        alert('Vennligst skriv navnet ditt med blokkbokstaver.');
        nameInput.focus();
        return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Signerer...';

    try {
        const response = await fetch(`${API_BASE}/signBooking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id, 
                role: 'requester',
                signatureData: signature,
                signerName: signerName
            })
        });
        
        if (!response.ok) throw new Error('Signering feilet');

        const result = await response.json();
        
        // Reload to show new state
        location.reload();

    } catch (error) {
        alert('Noe gikk galt under signering. Prøv igjen.');
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

const signContractLandlord = async () => {
    const id = getQueryParam('id');
    const btn = document.getElementById('btn-sign-landlord');
    const nameInput = document.getElementById('landlord-signer-name');
    
    // Validate signature
    const signature = getSignatureData('landlord-signature-canvas', 'landlord-signature-text-input');
    if (!signature) {
        alert('Du må signere (tegne eller skrive navn) før du kan sende inn.');
        return;
    }

    const signerName = nameInput.value.trim();
    if (!signerName) {
        alert('Vennligst skriv navnet ditt med blokkbokstaver.');
        nameInput.focus();
        return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Signerer...';

    try {
        const response = await fetch(`${API_BASE}/signBooking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id, 
                role: 'landlord',
                signatureData: signature,
                signerName: signerName
            })
        });
        
        if (!response.ok) throw new Error('Signering feilet');

        const result = await response.json();
        
        // Reload to show new state
        location.reload();

    } catch (error) {
        alert('Noe gikk galt under signering. Prøv igjen.');
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', loadContract);
