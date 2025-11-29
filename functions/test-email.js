require('dotenv').config({ path: './local.settings.json' });

const BASE_URL = 'http://127.0.0.1:7071/api';

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

async function testEmailTrigger() {
    logInfo('Testing Email Trigger...');
    
    const emailPayload = {
        to: 'fixafux@gmail.com',
        subject: 'Test Email from Local Function',
        text: 'This is a test email sent from the local Azure Functions environment.',
        html: '<p>This is a <strong>test email</strong> sent from the local Azure Functions environment.</p>'
    };

    try {
        const response = await makeRequest('POST', '/emailHttpTriggerBooking', emailPayload);
        
        if (response.status === 202) {
            logSuccess('Email trigger request accepted');
            console.log('   Response:', response.data);
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

// Run test
testEmailTrigger().catch(error => {
    logError(`Test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
});
