const { app } = require('@azure/functions');
const { addContractSignature } = require('../../../shared/cosmosDb');
const { createJsonResponse } = require('../../../shared/http');

app.http('signBooking', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { id, role, signatureData, signerName } = body;

            if (!id) {
                return createJsonResponse(400, { message: 'Missing booking ID' }, request);
            }

            // Capture metadata for the signature
            const signatureMetadata = {
                role: role || 'requester', // Default to requester for backward compatibility
                signatureData: signatureData, // { type: 'draw'|'text', data: '...' }
                signerName: signerName, // Printed name
                signedAt: new Date().toISOString(),
                userAgent: request.headers.get('user-agent') || 'Unknown',
                ipAddress: request.headers.get('x-forwarded-for') || 'Unknown'
            };

            // We don't have the partition key (date) in the request, so we rely on the 
            // cross-partition query implemented in cosmosDb.getBooking(id, null) inside addContractSignature
            const updatedBooking = await addContractSignature(id, null, signatureMetadata);

            if (!updatedBooking) {
                return createJsonResponse(404, { message: 'Booking not found' }, request);
            }

            // Return the signature details
            return createJsonResponse(200, { 
                message: 'Contract signed successfully',
                signedAt: signatureData.signedAt 
            }, request);

        } catch (error) {
            context.error(`Error signing booking:`, error);
            return createJsonResponse(500, { message: 'Internal server error' }, request);
        }
    }
});
