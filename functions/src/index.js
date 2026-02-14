const { app } = require('@azure/functions');
const { getPlunkApiUrl } = require('../shared/email');

console.log(`Azure Functions runtime starting on Node ${process.version} with Plunk endpoint ${getPlunkApiUrl()}`);

const loadingErrors = {};
const loadedFunctions = [];

const loadFunction = (name, path) => {
    try {
        require(path);
        loadedFunctions.push(name);
        console.log(`Successfully registered function: ${name}`);
    } catch (error) {
        console.error(`Failed to register function: ${name}`, error);
        loadingErrors[name] = error.message + '\n' + error.stack;
    }
};

app.setup({
    enableHttpStream: true,
});

// Health check to verify the app is running even if other functions fail
app.http('healthCheck', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (request, context) => {
        return { 
            body: JSON.stringify({
                status: 'OK',
                version: process.version,
                loadedFunctions,
                loadingErrors
            }, null, 2), 
            headers: {
                'Content-Type': 'application/json'
            },
            status: 200 
        };
    }
});

loadFunction('approveBooking', './functions/approveBooking');
loadFunction('bookingRequest', './functions/bookingRequest');
loadFunction('emailHttpTriggerBooking', './functions/emailHttpTriggerBooking');
loadFunction('getAdminCalendar', './functions/getAdminCalendar');
loadFunction('getCalendar', './functions/getCalendar');
loadFunction('rejectBooking', './functions/rejectBooking');
loadFunction('getBooking', './functions/getBooking');
loadFunction('signBooking', './functions/signBooking');
loadFunction('verifyAdmin', './functions/verifyAdmin');
loadFunction('sendReminder', './functions/sendReminder');
loadFunction('vippsInitiate', './functions/vippsInitiate');
loadFunction('vippsInitiateBooking', './functions/vippsInitiateBooking');
loadFunction('vippsInitiateContractPayment', './functions/vippsInitiateContractPayment');
loadFunction('vippsCheckStatus', './functions/vippsCheckStatus');
loadFunction('vippsCallback', './functions/vippsCallback');
