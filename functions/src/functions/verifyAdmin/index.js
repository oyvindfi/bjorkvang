const { app } = require('@azure/functions');
const { createJsonResponse, parseBody } = require('../../../shared/http');

app.http('verifyAdmin', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'auth/verify-admin',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { password } = body;

            const adminPassword = process.env.ADMIN_PASSWORD;

            if (!adminPassword) {
                context.error('ADMIN_PASSWORD is not set in environment variables.');
                return createJsonResponse(500, { error: 'Server configuration error' });
            }

            if (password === adminPassword) {
                return createJsonResponse(200, { success: true });
            } else {
                return createJsonResponse(401, { error: 'Invalid password' });
            }

        } catch (error) {
            context.error('Error verifying admin password:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
