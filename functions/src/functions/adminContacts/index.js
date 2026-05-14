const { app } = require('@azure/functions');
const { createJsonResponse, parseBody, requireAdminKey } = require('../../../shared/http');
const { listAdminContacts, saveAdminContact, deleteAdminContact } = require('../../../shared/cosmosDb');
const { normalizeNorwegianPhone } = require('../../../shared/sms');

/**
 * Admin SMS contact group management.
 *
 * GET    /api/admin/contacts          — list all contacts
 * POST   /api/admin/contacts          — add a contact  { name, phone }
 * DELETE /api/admin/contacts?id=...   — remove a contact
 *
 * All routes require x-admin-key header.
 */
app.http('adminContacts', {
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'notification-contacts',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const authError = requireAdminKey(request);
        if (authError) return authError;

        // --- GET: list contacts ---
        if (request.method === 'GET') {
            try {
                const contacts = await listAdminContacts();
                return createJsonResponse(200, { contacts }, request);
            } catch (err) {
                context.error('adminContacts GET error:', err);
                return createJsonResponse(500, { error: 'Kunne ikke hente kontakter.' }, request);
            }
        }

        // --- POST: add contact ---
        if (request.method === 'POST') {
            const body = await parseBody(request);
            const name = (body.name || '').trim();
            const phoneRaw = (body.phone || '').trim();

            if (!name) {
                return createJsonResponse(400, { error: 'Navn er påkrevd.' }, request);
            }
            const phone = normalizeNorwegianPhone(phoneRaw);
            if (!phone) {
                return createJsonResponse(400, { error: 'Ugyldig norsk telefonnummer. Oppgi 8 siffer.' }, request);
            }

            try {
                const contact = await saveAdminContact({ name, phone });
                context.info(`adminContacts: Added contact ${name} (${phone})`);
                return createJsonResponse(201, { contact }, request);
            } catch (err) {
                context.error('adminContacts POST error:', err);
                return createJsonResponse(500, { error: 'Kunne ikke lagre kontakt.' }, request);
            }
        }

        // --- DELETE: remove contact ---
        if (request.method === 'DELETE') {
            const id = request.query.get('id');
            if (!id || !id.trim()) {
                return createJsonResponse(400, { error: 'id er påkrevd.' }, request);
            }
            try {
                await deleteAdminContact(id.trim());
                context.info(`adminContacts: Deleted contact ${id}`);
                return createJsonResponse(200, { message: 'Kontakt slettet.' }, request);
            } catch (err) {
                context.error('adminContacts DELETE error:', err);
                return createJsonResponse(500, { error: 'Kunne ikke slette kontakt.' }, request);
            }
        }
    }
});
