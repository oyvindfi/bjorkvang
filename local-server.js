/**
 * Lokal utviklingsserver for Bjørkvang
 * 
 * Serverer nettsiden og håndterer Vipps API-kall direkte.
 * Krever IKKE Azure Functions. Fungerer med Node v18+.
 * 
 * Start: node local-server.js
 * Åpne:  http://localhost:7071/medlemskap
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Last inn miljøvariabler fra functions/local.settings.json
const settings = JSON.parse(fs.readFileSync('./functions/local.settings.json', 'utf-8'));
const env = settings.Values;

const PORT = 7071;
const VIPPS_BASE_URL = env.VIPPS_BASE_URL || 'https://apitest.vipps.no';
const MSN = env.VIPPS_MERCHANT_SERIAL_NUMBER;

// In-memory members store (local dev only; reset on server restart)
const inMemoryMembers = {};

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
};

// ─── Vipps API-hjelper ────────────────────────────────────────────────────────

async function getVippsToken() {
    const res = await fetch(`${VIPPS_BASE_URL}/accesstoken/get`, {
        method: 'POST',
        headers: {
            'client_id': env.VIPPS_CLIENT_ID,
            'client_secret': env.VIPPS_CLIENT_SECRET,
            'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
            'Merchant-Serial-Number': MSN
        }
    });
    if (!res.ok) throw new Error(`Token-feil: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.access_token;
}

async function vippsInitiatePayment({ amount, orderId, returnUrl, text, phoneNumber }) {
    const token = await getVippsToken();
    const body = {
        amount: { currency: 'NOK', value: amount },
        paymentMethod: { type: 'WALLET' },
        reference: orderId,
        returnUrl,
        userFlow: 'WEB_REDIRECT',
        paymentDescription: text
    };
    if (phoneNumber) body.customer = { phoneNumber };

    const res = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
            'Merchant-Serial-Number': MSN,
            'Idempotency-Key': orderId,
            'Vipps-System-Name': 'bjorkvang-local',
            'Vipps-System-Version': '1.0.0'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Betaling feilet: ${res.status} ${await res.text()}`);
    return await res.json();
}

async function vippsGetPayment(reference) {
    const token = await getVippsToken();
    const res = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments/${reference}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
            'Merchant-Serial-Number': MSN
        }
    });
    if (!res.ok) throw new Error(`Status-feil: ${res.status} ${await res.text()}`);
    return await res.json();
}

async function vippsCreateRecurringAgreement({ productName, productDescription, amount, intervalUnit, intervalCount, merchantRedirectUrl, merchantAgreementUrl, phoneNumber, chargeNow }) {
    const token = await getVippsToken();
    const idempotencyKey = `agreement-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const payload = {
        interval: { unit: intervalUnit || 'YEAR', count: intervalCount || 1 },
        pricing: { amount, currency: 'NOK' },
        merchantRedirectUrl,
        merchantAgreementUrl,
        productName,
        productDescription,
    };
    if (chargeNow !== false) {
        payload.initialCharge = { amount, description: productName, transactionType: 'DIRECT_CAPTURE' };
    }
    if (phoneNumber) payload.phoneNumber = phoneNumber;

    const res = await fetch(`${VIPPS_BASE_URL}/recurring/v3/agreements`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
            'Merchant-Serial-Number': MSN,
            'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Recurring-feil: ${res.status} ${await res.text()}`);
    return await res.json();
}

async function vippsGetRecurringAgreement(agreementId) {
    const token = await getVippsToken();
    const res = await fetch(`${VIPPS_BASE_URL}/recurring/v3/agreements/${agreementId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
            'Merchant-Serial-Number': MSN
        }
    });
    if (!res.ok) throw new Error(`Agreement-feil: ${res.status} ${await res.text()}`);
    return await res.json();
}

// ─── API-ruter ────────────────────────────────────────────────────────────────

async function handleApi(pathname, body, req) {
    const origin = `http://localhost:${PORT}`;

    // POST /api/vipps/initiate  →  Gammel engangsbetaling (beholdt for bakoverkompatibilitet)
    if (pathname === '/api/vipps/initiate') {
        const orderId = `membership-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const returnUrl = `${origin}/medlemskap?status=success&orderId=${orderId}`;
        const validTo = new Date();
        validTo.setFullYear(validTo.getFullYear() + 1);
        const validToStr = validTo.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
        const result = await vippsInitiatePayment({
            amount: 25000,
            orderId,
            returnUrl,
            text: `Medlemskap Helgøens Vel – gjelder frem til ${validToStr}`,
            phoneNumber: body.phoneNumber
        });
        return { url: result.redirectUrl, orderId };
    }

    // POST /api/vipps/membership/create  →  Løpende avtale (Recurring API)
    if (pathname === '/api/vipps/membership/create') {
        // Vipps Recurring API krever HTTPS-URLer – bruk produksjonsdomenet for redirects
        const siteBase = 'https://bjorkvang.org';
        const merchantRedirectUrl = `${siteBase}/medlemskap?status=success`;
        const merchantAgreementUrl = `${siteBase}/medlemskap#administrer`;
        const result = await vippsCreateRecurringAgreement({
            productName: 'Medlemskap Helgøens Vel',
            productDescription: 'Årlig kontingent – 250 kr. Gir rabatt på leie av Bjørkvang.',
            amount: 25000,
            intervalUnit: 'YEAR',
            intervalCount: 1,
            merchantRedirectUrl,
            merchantAgreementUrl,
            phoneNumber: body.phoneNumber,
            chargeNow: true,
        });
        // Persist locally so /api/members can show it
        if (result.agreementId) {
            inMemoryMembers[result.agreementId] = {
                id: result.agreementId,
                agreementId: result.agreementId,
                name: body.name || null,
                phoneNumber: body.phoneNumber || null,
                status: 'PENDING',
                productName: 'Medlemskap Helgøens Vel',
                amount: 25000,
                createdAt: new Date().toISOString(),
            };
        }
        return { url: result.vippsConfirmationUrl, agreementId: result.agreementId };
    }

    // POST /api/vipps/membership/status  →  Sjekk avtalestatus
    if (pathname === '/api/vipps/membership/status') {
        if (!body.agreementId) return { _status: 400, error: 'agreementId er påkrevd' };
        const agreement = await vippsGetRecurringAgreement(body.agreementId);
        return {
            status: agreement.status,
            agreementId: agreement.id,
            productName: agreement.productName,
            pricing: agreement.pricing,
            start: agreement.start,
            stop: agreement.stop,
        };
    }

    // POST /api/vipps/initiate-booking  →  Booking Forhåndsbetaling (50%)
    if (pathname === '/api/vipps/initiate-booking') {
        const { spaces, attendees, date, time, requesterName, eventType, phoneNumber, isMember } = body;
        if (!spaces || !Array.isArray(spaces) || !date || !time || !requesterName) {
            return { _status: 400, error: 'spaces, date, time og requesterName er påkrevd' };
        }
        const PRICING = { 'Peisestue': 1500, 'Salen': 3000, 'Hele lokalet': 4000, 'Bryllupspakke': 6000, 'Små møter': 30 };
        const MEMBER_ELIGIBLE = ['Hele lokalet', 'Bryllupspakke'];
        let total = 0;
        spaces.forEach(s => {
            if (s === 'Små møter') total += PRICING[s] * (parseInt(attendees) || 10);
            else if (PRICING[s]) total += PRICING[s];
        });
        if (isMember === true && spaces.some(s => MEMBER_ELIGIBLE.includes(s))) {
            total = Math.max(0, total - 500);
        }
        if (total === 0) return { _status: 400, error: 'Ugyldig romkombinasjon' };
        const depositAmount = Math.round(total * 100 / 2); // 50% i øre
        const orderId = `booking-${date}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const returnUrl = `${origin}/booking?status=success&orderId=${orderId}`;
        const result = await vippsInitiatePayment({
            amount: depositAmount,
            orderId,
            returnUrl,
            text: `Forhåndsbetaling (50%) – ${eventType || 'arrangement'} – ${spaces.join(', ')} – ${date} kl ${time}`,
            phoneNumber
        });
        return { url: result.redirectUrl, orderId, totalAmount: total, depositAmount: total / 2 };
    }

    // POST /api/vipps/check-status
    if (pathname === '/api/vipps/check-status') {
        if (!body.orderId) return { _status: 400, error: 'orderId er påkrevd' };
        const payment = await vippsGetPayment(body.orderId);
        return { status: payment.state, amount: payment.amount };
    }

    // GET /api/members  →  Liste over alle registrerte medlemmer
    if (pathname === '/api/members') {
        const members = Object.values(inMemoryMembers).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
        );
        return { members };
    }

    // POST /api/vipps/donate  →  Fri donasjon
    if (pathname === '/api/vipps/donate') {
        const amount = parseInt(body.amount);
        if (!amount || amount <= 0) return { _status: 400, error: 'Beløp må være større enn 0' };
        const orderId = `donation-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const returnUrl = `${origin}/stott-oss?status=success&orderId=${orderId}&amount=${amount}`;
        const kroner = Math.round(amount / 100);
        const result = await vippsInitiatePayment({
            amount,
            orderId,
            returnUrl,
            text: `Donasjon til Bjørkvang – ${kroner} kr`,
            phoneNumber: body.phoneNumber
        });
        return { url: result.redirectUrl, orderId, amount };
    }

    return { _status: 404, error: 'Ukjent endepunkt' };
}

// ─── HTTP-server ──────────────────────────────────────────────────────────────

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try { resolve(data ? JSON.parse(data) : {}); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

function sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(json);
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url);
    let pathname = decodeURIComponent(parsed.pathname);

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
        return res.end();
    }

    // API-ruter
    if (pathname.startsWith('/api/')) {
        try {
            const body = await readBody(req);
            const result = await handleApi(pathname, body, req);
            const status = result._status || 200;
            if (result._status) delete result._status;
            return sendJson(res, status, result);
        } catch (err) {
            console.error(`[API] ${pathname} feilet:`, err.message);
            return sendJson(res, 500, { error: err.message });
        }
    }

    // Statiske filer – støtt URL-er uten .html (feks /medlemskap → /medlemskap.html)
    let filePath = path.join(__dirname, pathname);

    if (pathname === '/') filePath = path.join(__dirname, 'index.html');

    // Prøv uten .html, deretter med
    const tryPaths = [filePath, filePath + '.html', path.join(filePath, 'index.html')];
    let resolvedPath = null;

    for (const p of tryPaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            resolvedPath = p;
            break;
        }
    }

    if (!resolvedPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Ikke funnet');
    }

    const ext = path.extname(resolvedPath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(resolvedPath).pipe(res);
});

server.listen(PORT, () => {
    console.log(`\n🌿 Bjørkvang lokal server kjører`);
    console.log(`   http://localhost:${PORT}/\n`);
    console.log(`   Sider:`);
    console.log(`   → http://localhost:${PORT}/medlemskap#betal`);
    console.log(`   → http://localhost:${PORT}/booking`);
    console.log(`   → http://localhost:${PORT}/lokaler`);
    console.log(`\n   Vipps API: ${VIPPS_BASE_URL}`);
    console.log(`   MSN:       ${MSN}`);
    console.log(`\n   Trykk Ctrl+C for å stoppe\n`);
});
