const fetch = require('node-fetch');
const path = require('path');

async function runPoc() {
    console.log('Creating test booking for Digital Contract POC...');
    
    const bookingData = {
        date: '2025-12-24',
        time: '17:00',
        requesterName: 'Ola Nordmann',
        requesterEmail: 'ola@example.com',
        eventType: 'Familiefeiring',
        spaces: ['Salen', 'Peisestue'],
        duration: 5,
        attendees: 20,
        message: 'Digital Contract POC Test'
    };

    try {
        // Attempt to create booking via local API
        // Using 127.0.0.1 to avoid IPv6 resolution issues (::1)
        const response = await fetch('http://127.0.0.1:7071/api/booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Failed to create booking. Status:', response.status);
            console.error('Response:', text);
            console.log('\nNOTE: If this failed due to email configuration, the booking might still have been saved if you are using Cosmos DB.');
            return;
        }

        const result = await response.json();
        const bookingId = result.id;

        console.log('✅ Booking created successfully!');
        console.log(`🆔 Booking ID: ${bookingId}`);
        
        // const absolutePath = path.resolve(__dirname, '../kontrakt.html');
        // const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}?id=${bookingId}`;
        const localhostUrl = `http://localhost:3000/kontrakt.html?id=${bookingId}`;

        console.log('\n---------------------------------------------------');
        console.log('🚀 HOW TO TEST:');
        console.log('1. Ensure "func start" is still running in the "functions" folder.');
        console.log('2. Ensure "npx serve" is running in the root folder (port 3000).');
        console.log('3. Click or copy this URL:');
        console.log(`\n   ${localhostUrl}\n`);
        console.log('4. Verify the details, click "Signer avtale", and watch it update!');
        console.log('---------------------------------------------------\n');

    } catch (error) {
        console.error('❌ Error connecting to API:', error.message);
        console.error('👉 Make sure you have "func start" running in the "functions" folder before running this script.');
    }
}

runPoc();
