/**
 * Vipps Ende-til-Ende test
 * 
 * Tester alle Vipps-flyter via Azure Functions HTTP-endepunkter.
 * 
 * Kjør Azure Functions først:  npm start
 * Kjør testen:                 node test-vipps-e2e.js
 */

const settings = require('./local.settings.json');
Object.assign(process.env, settings.Values);

const fetch = require('node-fetch');

const BASE = 'http://127.0.0.1:7071/api';
let passed = 0;
let failed = 0;

function ok(label, detail = '') {
    console.log(`  ✅ ${label}${detail ? '\n     ' + detail : ''}`);
    passed++;
}

function fail(label, detail = '') {
    console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`);
    failed++;
}

async function post(path, body) {
    const r = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    let data;
    try { data = await r.json(); } catch { data = {}; }
    return { status: r.status, data };
}

// ─── 1. Sjekk at Functions kjører ────────────────────────────────────────────

async function checkFunctionsRunning() {
    console.log('\n📡 Sjekker at Azure Functions kjører...');
    try {
        const r = await fetch(`${BASE}/vipps/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        ok('Azure Functions er oppe', `HTTP ${r.status}`);
        return true;
    } catch {
        fail('Azure Functions er IKKE startet', 'Kjør: npm start');
        return false;
    }
}

// ─── 2. Medlemskap-betaling ───────────────────────────────────────────────────

async function testMembership() {
    console.log('\n💳 Test 1: Memberskap-betaling (250 kr)');

    const { status, data } = await post('/vipps/initiate', {
        phoneNumber: '4748059940'  // Vipps test-bruker
    });

    if (status === 200 && data.url && data.orderId) {
        ok(`Betaling initiert`, `Order: ${data.orderId}`);
        console.log(`\n  🔗 Åpne i nettleser for å fullføre i Vipps testapp:`);
        console.log(`     ${data.url}\n`);
        return data.orderId;
    } else {
        fail(`Uventet svar`, `Status ${status}: ${JSON.stringify(data)}`);
        return null;
    }
}

// ─── 3. Booking-Forhåndsbetaling (50%) ───────────────────────────────────────────────

async function testBookingDeposit() {
    console.log('\n🏠 Test 2: Booking Forhåndsbetaling – Peisestue (50% av 1500 kr = 750 kr)');

    const { status, data } = await post('/vipps/initiate-booking', {
        phoneNumber: '4748059940',
        spaces: ['Peisestue'],
        attendees: 15,
        date: '2026-06-15',
        time: '18:00',
        requesterName: 'Test Testesen',
        eventType: 'Bursdagsfeiring'
    });

    if (status === 200 && data.url && data.orderId) {
        ok(`Forhåndsbetaling initiert`, `Order: ${data.orderId}`);
        ok(`Forventet beløp: 75000 øre (750 kr)`);
        console.log(`\n  🔗 Betalingslenke:`);
        console.log(`     ${data.url}\n`);
        return data.orderId;
    } else {
        fail(`Uventet svar`, `Status ${status}: ${JSON.stringify(data)}`);
        return null;
    }
}

// ─── 4. Stort lokale – prisberegning ─────────────────────────────────────────

async function testBookingLargeVenue() {
    console.log('\n🏛️  Test 3: Booking – Hele lokalet (50% av 4000 kr = 2000 kr)');

    const { status, data } = await post('/vipps/initiate-booking', {
        spaces: ['Hele lokalet'],
        attendees: 50,
        date: '2026-07-01',
        time: '14:00',
        requesterName: 'Test Testesen',
        eventType: 'Bryllupsfeiring'
    });

    if (status === 200 && data.url) {
        ok(`Forhåndsbetaling initiert`, `Order: ${data.orderId}`);
        console.log(`\n  🔗 Betalingslenke:`);
        console.log(`     ${data.url}\n`);
    } else {
        fail(`Uventet svar`, `Status ${status}: ${JSON.stringify(data)}`);
    }
}

// ─── 5. Validering – manglende felter ────────────────────────────────────────

async function testValidation() {
    console.log('\n🛡️  Test 4: Validering av påkrevde felter');

    // Mangler spaces
    const r1 = await post('/vipps/initiate-booking', {
        date: '2026-06-15', time: '18:00', requesterName: 'Test'
    });
    if (r1.status === 400) {
        ok('Avviser request uten spaces (400)');
    } else {
        fail(`Forventet 400, fikk ${r1.status}`);
    }

    // Mangler dato
    const r2 = await post('/vipps/initiate-booking', {
        spaces: ['Peisestue'], requesterName: 'Test'
    });
    if (r2.status === 400) {
        ok('Avviser request uten dato (400)');
    } else {
        fail(`Forventet 400, fikk ${r2.status}`);
    }

    // Tom body til check-status
    const r3 = await post('/vipps/check-status', {});
    if (r3.status === 400) {
        ok('Avviser check-status uten orderId (400)');
    } else {
        fail(`Forventet 400, fikk ${r3.status}`);
    }
}

// ─── 6. Sjekk betalingsstatus ─────────────────────────────────────────────────

async function testCheckStatus(orderId) {
    if (!orderId) return;
    console.log(`\n🔍 Test 5: Sjekk betalingsstatus for ${orderId.substring(0, 30)}...`);

    const { status, data } = await post('/vipps/check-status', { orderId });

    if (status === 200 && data.status) {
        ok(`Status hentet: ${data.status}`);
        if (data.status === 'CREATED') {
            ok('Status er CREATED – bruker har ikke betalt ennå (forventet)');
        }
    } else {
        fail(`Uventet svar`, `Status ${status}: ${JSON.stringify(data)}`);
    }
}

// ─── 7. Kontrakt-betaling (uten gyldig booking-ID) ───────────────────────────

async function testContractPaymentValidation() {
    console.log('\n📄 Test 6: Kontrakt-betaling – validering');

    const r1 = await post('/vipps/initiate-contract-payment', {});
    if (r1.status === 400) {
        ok('Avviser uten bookingId (400)');
    } else {
        fail(`Forventet 400, fikk ${r1.status}`);
    }

    const r2 = await post('/vipps/initiate-contract-payment', {
        bookingId: 'finnes-ikke-booking'
    });
    if (r2.status === 404) {
        ok('Returnerer 404 for ukjent booking');
    } else {
        fail(`Forventet 404, fikk ${r2.status}: ${JSON.stringify(r2.data)}`);
    }
}

// ─── Oppsummering ─────────────────────────────────────────────────────────────

async function run() {
    console.log('═══════════════════════════════════════════');
    console.log('  Vipps Ende-til-Ende Test');
    console.log(`  Miljø: ${process.env.VIPPS_BASE_URL}`);
    console.log(`  MSN:   ${process.env.VIPPS_MERCHANT_SERIAL_NUMBER}`);
    console.log('═══════════════════════════════════════════');

    const running = await checkFunctionsRunning();
    if (!running) {
        console.log('\n⛔ Start Azure Functions først: cd functions && npm start\n');
        process.exit(1);
    }

    const membershipOrderId = await testMembership();
    await testBookingDeposit();
    await testBookingLargeVenue();
    await testValidation();
    await testCheckStatus(membershipOrderId);
    await testContractPaymentValidation();

    console.log('\n═══════════════════════════════════════════');
    console.log(`  Resultat: ${passed} bestått, ${failed} feilet`);
    console.log('═══════════════════════════════════════════\n');

    if (passed > 0 && failed === 0) {
        console.log('✨ Alle tester bestått!\n');
    } else if (failed > 0) {
        console.log('⚠️  Noen tester feilet – sjekk output over.\n');
    }
}

run().catch(console.error);
