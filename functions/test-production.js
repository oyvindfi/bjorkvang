/**
 * Production Test Script for Bjørkvang Functions
 * Tests the deployed Azure Functions endpoints
 */

const BASE_URL = 'https://bjorkvang-duhsaxahgfe0btgv.westeurope-01.azurewebsites.net/api';

// Test data
const testBooking = {
    date: '2025-12-31', // Far future date to avoid conflict
    time: '23:00',
    requesterName: 'Production Test Bot',
    requesterEmail: 'test@finsrud.cloud', // Use a safe email or the configured one
    message: 'Dette er en automatisk test av produksjonsmiljøet. Kan slettes.'
};

let createdBookingId = null;

// ANSI color codes
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
        console.log(`   ${method} ${url}`);
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

async function runProductionTests() {
    console.log('\n' + '='.repeat(60));
    log('🚀', colors.cyan, 'Testing Deployed Azure Functions (Production)');
    console.log('='.repeat(60));
    console.log(`Target: ${BASE_URL}\n`);

    // 1. Test Public Calendar
    logInfo('Test 1: Fetching public calendar...');
    try {
        const response = await makeRequest('GET', '/booking/calendar');
        if (response.status === 200 && response.data.bookings) {
            logSuccess(`Success! Retrieved ${response.data.bookings.length} bookings.`);
        } else {
            logError(`Failed. Status: ${response.status}`);
            console.log('Response:', response.data);
        }
    } catch (error) {
        logError(`Error: ${error.message}`);
    }
    console.log('');

    // 2. Test Admin Calendar
    logInfo('Test 2: Fetching admin calendar...');
    try {
        const response = await makeRequest('GET', '/booking/admin');
        if (response.status === 200 && response.data.bookings) {
            logSuccess(`Success! Retrieved ${response.data.bookings.length} bookings (with details).`);
        } else {
            logError(`Failed. Status: ${response.status}`);
        }
    } catch (error) {
        logError(`Error: ${error.message}`);
    }
    console.log('');

    // 3. Create Test Booking
    logInfo('Test 3: Creating a test booking...');
    try {
        const response = await makeRequest('POST', '/booking', testBooking);
        if (response.status === 202 && response.data.id) {
            createdBookingId = response.data.id;
            logSuccess(`Success! Booking created with ID: ${createdBookingId}`);
        } else {
            logError(`Failed. Status: ${response.status}`);
            console.log('Response:', response.data);
        }
    } catch (error) {
        logError(`Error: ${error.message}`);
    }
    console.log('');

    // 4. Verify Booking in Calendar
    if (createdBookingId) {
        logInfo('Test 4: Verifying booking in calendar...');
        try {
            // Wait a moment for consistency
            await new Promise(r => setTimeout(r, 2000));
            
            const response = await makeRequest('GET', '/booking/calendar');
            if (response.status === 200 && response.data.bookings) {
                const found = response.data.bookings.find(b => b.id === createdBookingId);
                if (found) {
                    logSuccess(`Success! Found booking ${createdBookingId} in calendar.`);
                } else {
                    logError('Booking not found in calendar.');
                }
            }
        } catch (error) {
            logError(`Error: ${error.message}`);
        }
        console.log('');

        // 5. Clean up (Reject)
        logInfo('Test 5: Cleaning up (Rejecting booking)...');
        try {
            const response = await makeRequest('POST', `/booking/reject?id=${encodeURIComponent(createdBookingId)}`, {
                reason: 'Automated test cleanup'
            });
            if (response.status === 200) {
                logSuccess('Success! Booking rejected/cleaned up.');
            } else {
                logError(`Failed to reject. Status: ${response.status}`);
            }
        } catch (error) {
            logError(`Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Tests completed.');
    console.log('='.repeat(60) + '\n');
}

runProductionTests();
