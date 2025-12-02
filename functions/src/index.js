const { app } = require('@azure/functions');
const { getPlunkApiUrl } = require('../shared/email');

console.log(`Azure Functions runtime starting on Node ${process.version} with Plunk endpoint ${getPlunkApiUrl()}`);

app.setup({
    enableHttpStream: true,
});

// Trigger redeploy

require('./functions/approveBooking');
require('./functions/bookingRequest');
require('./functions/emailHttpTriggerBooking');
require('./functions/getAdminCalendar');
require('./functions/getCalendar');
require('./functions/rejectBooking');
require('./functions/getBooking');
require('./functions/signBooking');
require('./functions/verifyAdmin');
require('./functions/sendReminder');
require('./functions/vippsInitiate');
require('./functions/vippsCheckStatus');
require('./functions/vippsCallback');
