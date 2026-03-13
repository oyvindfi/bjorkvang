/**
 * Vipps integrasjonstest
 * 
 * Kjør med: node test-vipps.js
 * Krever at local.settings.json er konfigurert med gyldige Vipps testkredentialer.
 * 
 * Testbeløp som trigges i Vipps testappen:
 *   151  → Ikke nok penger
 *   182  → Nektet av kortutgiver
 *   183  → Mistanke om svindel
 *   184  → Uttaksgrense overskredet
 *   186  → Kortet har utløpt
 *   187  → Ugyldig kort
 *   197  → 3D Secure nektet (kun NO)
 *   201  → Ukjent resultat i 1 time
 *   202  → SCA påkrevd (kun NO)
 */

require('dotenv').config({ path: './local.settings.json' });

// Last inn miljøvariabler fra local.settings.json-format
const settings = require('./local.settings.json');
Object.assign(process.env, settings.Values);

const { initiatePayment, getPayment, VIPPS_TEST_AMOUNTS } = require('./shared/vipps');

const BASE_URL = 'http://127.0.0.1:7071/api';
const TEST_PHONE = '47451610'; // Vipps testebruker-nummer (fra Vipps MT)

function generateOrderId() {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testGetAccessToken() {
    console.log('\n🔑 Tester tilgangstoken fra Vipps...');
    try {
        // initiatePayment kaller getAccessToken internt - vi bruker et minimalt beløp
        const orderId = generateOrderId();
        const result = await initiatePayment({
            amount: 100, // 1 kr
            returnUrl: `http://localhost:3000/complete-payment.html?orderId=${orderId}`,
            orderId,
            text: 'Tilgangstoken-test'
        });
        console.log('✅ Tilgangstoken OK, betaling initiert');
        console.log(`   Reference: ${result.reference}`);
        console.log(`   Redirect URL: ${result.redirectUrl}`);
        return result.reference;
    } catch (err) {
        console.log('❌ Feil:', err.message);
        return null;
    }
}

async function testNormalPayment() {
    console.log('\n💳 Tester normal betaling (25000 øre = 250 kr)...');
    try {
        const orderId = generateOrderId();
        const result = await initiatePayment({
            amount: 25000, // 250 kr (medlemsavgift)
            phoneNumber: TEST_PHONE,
            returnUrl: `http://localhost:3000/complete-payment.html?orderId=${orderId}`,
            orderId,
            text: 'Bjørkvang medlemsavgift 2026'
        });
        console.log('✅ Betaling initiert');
        console.log(`   Reference: ${result.reference}`);
        console.log(`   Redirect: ${result.redirectUrl}`);
        return result.reference;
    } catch (err) {
        console.log('❌ Feil:', err.message);
        return null;
    }
}

async function testGetPaymentStatus(reference) {
    if (!reference) return;
    console.log(`\n🔍 Henter betalingsstatus for ${reference}...`);
    try {
        await sleep(2000); // Gi Vipps litt tid
        const payment = await getPayment(reference);
        console.log('✅ Status hentet');
        console.log(`   State: ${payment.state}`);
        console.log(`   Amount: ${payment.amount?.value} ${payment.amount?.currency}`);
    } catch (err) {
        console.log('❌ Feil:', err.message);
    }
}

async function testErrorAmounts() {
    console.log('\n⚠️  Tester feilbeløp (disse skal feile i testappen)...');

    const errorCases = [
        { amount: VIPPS_TEST_AMOUNTS.INSUFFICIENT_FUNDS, label: 'Ikke nok penger (151 øre)' },
        { amount: VIPPS_TEST_AMOUNTS.REFUSED_BY_ISSUER, label: 'Nektet av kortutgiver (182 øre)' },
        { amount: VIPPS_TEST_AMOUNTS.EXPIRED_CARD, label: 'Utløpt kort (186 øre)' },
        { amount: VIPPS_TEST_AMOUNTS.INVALID_CARD, label: 'Ugyldig kort (187 øre)' },
    ];

    for (const { amount, label } of errorCases) {
        const orderId = generateOrderId();
        try {
            const result = await initiatePayment({
                amount,
                returnUrl: `http://localhost:3000/complete-payment.html?orderId=${orderId}`,
                orderId,
                text: `Testbetaling: ${label}`
            });
            console.log(`   ✅ ${label} → Initiering OK (bruker avviser i appen)`);
            console.log(`      Reference: ${result.reference}`);
        } catch (err) {
            console.log(`   ❌ ${label} → ${err.message}`);
        }
        await sleep(500);
    }
}

async function testVippsEndpoint() {
    console.log('\n🌐 Tester Vipps-HTTP-endepunkt via Azure Functions...');
    try {
        const response = await fetch(`${BASE_URL}/vipps/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'membership',
                phoneNumber: TEST_PHONE,
                returnUrl: 'http://localhost:3000/complete-payment.html'
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ HTTP-endepunkt OK');
            console.log(`   Payment URL: ${data.paymentUrl}`);
            console.log(`   Order ID: ${data.orderId}`);
        } else {
            const text = await response.text();
            console.log(`❌ HTTP-feil ${response.status}: ${text}`);
        }
    } catch (err) {
        console.log('❌ Tilkobling feilet (er Azure Functions startet?):', err.message);
    }
}

async function run() {
    console.log('🚀 Starter Vipps integrasjonstester');
    console.log(`   Miljø: ${process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no'}`);
    console.log(`   MSN: ${process.env.VIPPS_MERCHANT_SERIAL_NUMBER}`);

    const reference = await testGetAccessToken();
    await testGetPaymentStatus(reference);
    await testNormalPayment();
    await testErrorAmounts();
    await testVippsEndpoint();

    console.log('\n✨ Tester fullført');
    console.log('\nMerk: Feilbeløp-testene initieres OK, men Vipps testappen vil avvise dem.');
    console.log('Testapper: https://developer.vippsmobilepay.com/docs/test-environment/');
}

run().catch(console.error);
