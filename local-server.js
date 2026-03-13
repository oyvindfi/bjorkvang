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

// ─── API-ruter ────────────────────────────────────────────────────────────────

async function handleApi(pathname, body, req) {
    const origin = `http://localhost:${PORT}`;

    // POST /api/vipps/initiate  →  Medlemskapsbetaling 250 kr
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

    // POST /api/vipps/initiate-booking  →  Booking depositum (50%)
    if (pathname === '/api/vipps/initiate-booking') {
        const { spaces, attendees, date, time, requesterName, eventType, phoneNumber } = body;
        if (!spaces || !Array.isArray(spaces) || !date || !time || !requesterName) {
            return { _status: 400, error: 'spaces, date, time og requesterName er påkrevd' };
        }
        const PRICING = { 'Peisestue': 1500, 'Salen': 3000, 'Hele lokalet': 4000, 'Bryllupspakke': 6000, 'Små møter': 30 };
        let total = 0;
        spaces.forEach(s => {
            if (s === 'Små møter') total += PRICING[s] * (parseInt(attendees) || 10);
            else if (PRICING[s]) total += PRICING[s];
        });
        if (total === 0) return { _status: 400, error: 'Ugyldig romkombinasjon' };
        const depositAmount = Math.round(total * 100 / 2); // 50% i øre
        const orderId = `booking-${date}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const returnUrl = `${origin}/booking?status=success&orderId=${orderId}`;
        const result = await vippsInitiatePayment({
            amount: depositAmount,
            orderId,
            returnUrl,
            text: `Depositum (50%) – ${eventType || 'arrangement'} – ${spaces.join(', ')} – ${date} kl ${time}`,
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
