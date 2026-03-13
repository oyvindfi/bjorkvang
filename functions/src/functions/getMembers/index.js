const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { listMembers } = require('../../../shared/cosmosDb');

app.http('getMembers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'members',
    handler: async (request, context) => {
        try {
            const members = await listMembers();
            context.log(`getMembers: returned ${members.length} records`);
            return createJsonResponse(200, { members }, request);
        } catch (error) {
            context.error('getMembers error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
