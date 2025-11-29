const fetch = require('node-fetch');

async function testGetBooking() {
    // 1. Create a booking first to get an ID
    console.log('Creating booking...');
    const createRes = await fetch('http://127.0.0.1:7071/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: '2025-12-31',
            time: '18:00',
            requesterName: 'Test User',
            requesterEmail: 'test@example.com',
            eventType: 'Test',
            spaces: ['Salen'],
            duration: 4
        })
    });

    if (!createRes.ok) {
        console.error('Failed to create booking:', await createRes.text());
        return;
    }

    const booking = await createRes.json();
    console.log('Created booking:', booking.id);

    // 2. Try to fetch it via getBooking
    console.log('Fetching booking...');
    const getRes = await fetch(`http://127.0.0.1:7071/api/getBooking?id=${booking.id}`);
    
    if (getRes.ok) {
        const fetched = await getRes.json();
        console.log('✅ Success! Fetched booking:', fetched.id);
        console.log('Name:', fetched.requesterName);
    } else {
        console.error('❌ Failed to fetch booking:', getRes.status, await getRes.text());
    }
}

testGetBooking().catch(console.error);
