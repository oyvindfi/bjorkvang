const { app } = require('@azure/functions');
const { createJsonResponse, requireAdminKey } = require('../../../shared/http');
const { runAllProbes, aggregateStatus } = require('../../../shared/healthProbes');

// 30 s server-side cache so multiple admin tabs (or polling clients) cannot
// trigger a probe storm against third-party APIs.
const CACHE_TTL_MS = 30 * 1000;
let cache = null; // { fetchedAt: number, payload: object }

const buildPayload = async () => {
    const probes = await runAllProbes();
    return {
        status: aggregateStatus(probes),
        generatedAt: new Date().toISOString(),
        probes
    };
};

app.http('systemHealth', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'system/health',
    handler: async (request, context) => {
        const authError = requireAdminKey(request);
        if (authError) return authError;

        const url = new URL(request.url);
        const force = url.searchParams.get('fresh') === '1';
        const now = Date.now();

        if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
            return createJsonResponse(200, {
                ...cache.payload,
                cached: true,
                cacheAgeMs: now - cache.fetchedAt
            }, request);
        }

        try {
            const payload = await buildPayload();
            cache = { fetchedAt: now, payload };
            context.log(`systemHealth: ${payload.status} — ${payload.probes.length} probes`);
            return createJsonResponse(200, { ...payload, cached: false, cacheAgeMs: 0 }, request);
        } catch (err) {
            context.log.error('systemHealth: unexpected failure', err);
            return createJsonResponse(500, {
                status: 'down',
                error: 'Kunne ikke kjøre helse-sjekk',
                message: err && err.message ? err.message : String(err)
            }, request);
        }
    }
});
