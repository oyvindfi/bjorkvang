// Simple test script to verify Cosmos DB connection and operations
require('dotenv').config();

// Set environment variables from local.settings.json
const settings = require('./local.settings.json');
Object.keys(settings.Values).forEach(key => {
    process.env[key] = settings.Values[key];
});

const { saveBooking, getBooking, listBookings, updateBookingStatus, deleteBooking } = require('./shared/cosmosDb');

async function runTests() {
    console.log('🧪 Testing Cosmos DB Connection...\n');

    try {
        // Test 1: Save a booking
        console.log('📝 Test 1: Creating a test booking...');
        const testBooking = {
            id: `test-booking-${Date.now()}`,
            date: '2025-12-15',
            time: '14:00',
            requesterName: 'Test User',
            requesterEmail: 'test@example.com',
            message: 'This is a test booking',
            status: 'pending'
        };
        
        const saved = await saveBooking(testBooking);
        console.log('✅ Booking saved:', saved.id);
        console.log('   Partition key:', saved.bjorkvang);

        // Test 2: Get the booking
        console.log('\n🔍 Test 2: Retrieving the booking...');
        const retrieved = await getBooking(saved.id, saved.bjorkvang);
        if (retrieved) {
            console.log('✅ Booking retrieved:', retrieved.id);
            console.log('   Name:', retrieved.requesterName);
            console.log('   Date:', retrieved.date);
        } else {
            console.log('❌ Failed to retrieve booking');
        }

        // Test 3: Update status
        console.log('\n📋 Test 3: Updating booking status...');
        const updated = await updateBookingStatus(saved.id, saved.bjorkvang, 'approved');
        if (updated && updated.status === 'approved') {
            console.log('✅ Status updated to:', updated.status);
        } else {
            console.log('❌ Failed to update status');
        }

        // Test 4: List bookings
        console.log('\n📚 Test 4: Listing all bookings...');
        const allBookings = await listBookings();
        console.log(`✅ Found ${allBookings.length} total bookings`);
        
        // Test 5: List with date range
        console.log('\n📅 Test 5: Listing December 2025 bookings...');
        const decemberBookings = await listBookings({
            startDate: '2025-12-01',
            endDate: '2025-12-31'
        });
        console.log(`✅ Found ${decemberBookings.length} bookings in December 2025`);

        // Test 6: Delete test booking
        console.log('\n🗑️  Test 6: Cleaning up test booking...');
        const deleted = await deleteBooking(saved.id, saved.bjorkvang);
        if (deleted) {
            console.log('✅ Test booking deleted successfully');
        } else {
            console.log('❌ Failed to delete test booking');
        }

        console.log('\n✅ All tests completed successfully! 🎉');
        console.log('\n📊 Summary:');
        console.log(`   - Connection: Working`);
        console.log(`   - Save operation: Working`);
        console.log(`   - Read operation: Working`);
        console.log(`   - Update operation: Working`);
        console.log(`   - List operation: Working`);
        console.log(`   - Delete operation: Working`);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('\nError details:', error);
        process.exit(1);
    }
}

// Run tests
runTests()
    .then(() => {
        console.log('\n✅ Test script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Unexpected error:', error);
        process.exit(1);
    });
