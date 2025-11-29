/**
 * Integration test script for Azure Functions with Cosmos DB
 * Tests all booking endpoints to verify Cosmos DB integration
 */

require('dotenv').config({ path: './local.settings.json' });

const BASE_URL = 'http://127.0.0.1:7071/api';

// Test data
const testBooking = {
    date: '2025-12-20',
    time: '14:00',
    requesterName: 'Test Bruker',
    requesterEmail: 'test@example.com',
    message: 'Dette er en test booking'
};

let createdBookingId = null;

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(emoji, color, message) {
    console.log(`${emoji} ${color}${message}${colors.reset}`);
}

function logSuccess(message) {
    log('✅', colors.green, message);
}

function logError(message) {
    log('❌', colors.red, message);
}

function logInfo(message) {
    log('📝', colors.blue, message);
}

function logWarning(message) {
    log('⚠️', colors.yellow, message);
}

async function makeRequest(method, endpoint, body = null) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return {
            status: response.status,
            ok: response.ok,
            data
        };
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

async function test1_CreateBooking() {
    logInfo('Test 1: Creating a new booking...');
    
    try {
        const response = await makeRequest('POST', '/booking', testBooking);
        
        if (response.status === 202 && response.data.id) {
            createdBookingId = response.data.id;
            logSuccess(`Booking created with ID: ${createdBookingId}`);
            logInfo(`   Status: ${response.data.status}`);
            return true;
        } else {
            logError(`Unexpected response: ${response.status}`);
            console.log('   Response:', response.data);
            return false;
        }
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function test2_GetPublicCalendar() {
    logInfo('Test 2: Fetching public calendar...');
    
    try {
        const response = await makeRequest('GET', '/booking/calendar');
        
        if (response.status === 200 && response.data.bookings) {
            const bookingCount = response.data.bookings.length;
            logSuccess(`Retrieved ${bookingCount} bookings from public calendar`);
            
            // Verify our booking is in the list
            const ourBooking = response.data.bookings.find(b => b.id === createdBookingId);
            if (ourBooking) {
                logInfo(`   Our booking found: ${ourBooking.date} at ${ourBooking.time}`);
                logInfo(`   Status: ${ourBooking.status}`);
            } else {
                logWarning('   Our booking not found in public calendar yet');
            }
            return true;
        } else {
            logError(`Unexpected response: ${response.status}`);
            console.log('   Response:', response.data);
            return false;
        }
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function test3_GetAdminCalendar() {
    logInfo('Test 3: Fetching admin calendar...');
    
    try {
        const response = await makeRequest('GET', '/booking/admin');
        
        if (response.status === 200 && response.data.bookings) {
            const bookingCount = response.data.bookings.length;
            logSuccess(`Retrieved ${bookingCount} bookings from admin calendar`);
            
            // Find our booking
            const ourBooking = response.data.bookings.find(b => b.id === createdBookingId);
            if (ourBooking) {
                logInfo(`   Our booking found:`);
                logInfo(`   - Date: ${ourBooking.date} at ${ourBooking.time}`);
                logInfo(`   - Name: ${ourBooking.requesterName}`);
                logInfo(`   - Email: ${ourBooking.requesterEmail}`);
                logInfo(`   - Status: ${ourBooking.status}`);
            } else {
                logWarning('   Our booking not found in admin calendar');
            }
            return true;
        } else {
            logError(`Unexpected response: ${response.status}`);
            console.log('   Response:', response.data);
            return false;
        }
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function test4_ApproveBooking() {
    logInfo('Test 4: Approving the booking...');
    
    if (!createdBookingId) {
        logError('No booking ID available. Skipping test.');
        return false;
    }
    
    try {
        const response = await makeRequest('GET', `/booking/approve?id=${encodeURIComponent(createdBookingId)}`);
        
        if (response.status === 200) {
            logSuccess('Booking approved successfully');
            logInfo(`   Response: ${response.data.substring(0, 100)}...`);
            return true;
        } else {
            logError(`Unexpected response: ${response.status}`);
            console.log('   Response:', response.data);
            return false;
        }
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function test5_VerifyApproval() {
    logInfo('Test 5: Verifying booking status changed to approved...');
    
    try {
        const response = await makeRequest('GET', '/booking/admin');
        
        if (response.status === 200 && response.data.bookings) {
            const ourBooking = response.data.bookings.find(b => b.id === createdBookingId);
            
            if (ourBooking) {
                if (ourBooking.status === 'approved') {
                    logSuccess(`Booking status is now: ${ourBooking.status}`);
                    return true;
                } else {
                    logError(`Unexpected status: ${ourBooking.status} (expected 'approved')`);
                    return false;
                }
            } else {
                logError('Booking not found in admin calendar');
                return false;
            }
        } else {
            logError(`Unexpected response: ${response.status}`);
            return false;
        }
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function test6_CreateAndRejectBooking() {
    logInfo('Test 6: Creating and rejecting a second booking...');
    
    const secondBooking = {
        ...testBooking,
        date: '2025-12-21',
        time: '16:00',
        requesterName: 'Test Bruker 2'
    };
    
    try {
        // Create second booking
        const createResponse = await makeRequest('POST', '/booking', secondBooking);
        
        if (createResponse.status !== 202 || !createResponse.data.id) {
            logError(`Failed to create second booking: ${createResponse.status}`);
            return false;
        }
        
        const secondBookingId = createResponse.data.id;
        logInfo(`   Created second booking: ${secondBookingId}`);
        
        // Reject it with a reason
        const rejectResponse = await makeRequest('POST', `/booking/reject?id=${encodeURIComponent(secondBookingId)}`, {
            reason: 'Test rejection - automatisk test'
        });
        
        if (rejectResponse.status === 200) {
            logSuccess('Second booking rejected successfully');
            
            // Verify status
            const verifyResponse = await makeRequest('GET', '/booking/admin');
            if (verifyResponse.status === 200 && verifyResponse.data.bookings) {
                const rejectedBooking = verifyResponse.data.bookings.find(b => b.id === secondBookingId);
                if (rejectedBooking && rejectedBooking.status === 'rejected') {
                    logSuccess(`Verified status is: ${rejectedBooking.status}`);
                    return true;
                }
            }
        }
        
        logError('Rejection test failed');
        return false;
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function test7_ValidationTests() {
    logInfo('Test 7: Testing input validation...');
    
    const testCases = [
        {
            name: 'Missing required field (date)',
            data: { time: '14:00', requesterName: 'Test', requesterEmail: 'test@example.com' },
            expectedStatus: 400
        },
        {
            name: 'Invalid email format',
            data: { ...testBooking, requesterEmail: 'invalid-email' },
            expectedStatus: 400
        },
        {
            name: 'Invalid date format',
            data: { ...testBooking, date: '20-12-2025' },
            expectedStatus: 400
        },
        {
            name: 'Invalid time format',
            data: { ...testBooking, time: '2:00 PM' },
            expectedStatus: 400
        }
    ];
    
    let passedTests = 0;
    
    for (const testCase of testCases) {
        try {
            const response = await makeRequest('POST', '/booking', testCase.data);
            
            if (response.status === testCase.expectedStatus) {
                logSuccess(`   ✓ ${testCase.name}`);
                passedTests++;
            } else {
                logError(`   ✗ ${testCase.name}: Got ${response.status}, expected ${testCase.expectedStatus}`);
            }
        } catch (error) {
            logError(`   ✗ ${testCase.name}: ${error.message}`);
        }
    }
    
    logInfo(`Validation tests: ${passedTests}/${testCases.length} passed`);
    return passedTests === testCases.length;
}

async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    log('🧪', colors.cyan, 'Azure Functions + Cosmos DB Integration Tests');
    console.log('='.repeat(60) + '\n');
    
    logWarning('⚠️  Make sure Azure Functions are running: npm start');
    logWarning('⚠️  Make sure Cosmos DB connection is configured\n');
    
    const tests = [
        { name: 'Create Booking', fn: test1_CreateBooking },
        { name: 'Get Public Calendar', fn: test2_GetPublicCalendar },
        { name: 'Get Admin Calendar', fn: test3_GetAdminCalendar },
        { name: 'Approve Booking', fn: test4_ApproveBooking },
        { name: 'Verify Approval', fn: test5_VerifyApproval },
        { name: 'Create and Reject Booking', fn: test6_CreateAndRejectBooking },
        { name: 'Input Validation', fn: test7_ValidationTests }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const passed = await test.fn();
            results.push({ name: test.name, passed });
            console.log(''); // Empty line between tests
        } catch (error) {
            logError(`${test.name} threw an error: ${error.message}`);
            results.push({ name: test.name, passed: false });
            console.log('');
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    log('📊', colors.cyan, 'Test Summary');
    console.log('='.repeat(60) + '\n');
    
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    
    results.forEach(result => {
        if (result.passed) {
            logSuccess(`${result.name}`);
        } else {
            logError(`${result.name}`);
        }
    });
    
    console.log('\n' + '='.repeat(60));
    if (passedCount === totalCount) {
        logSuccess(`All tests passed! (${passedCount}/${totalCount}) 🎉`);
    } else {
        logWarning(`Tests passed: ${passedCount}/${totalCount}`);
    }
    console.log('='.repeat(60) + '\n');
    
    process.exit(passedCount === totalCount ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
});
