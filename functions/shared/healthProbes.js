/**
 * Health probes for the central admin "System / Helse" dashboard.
 *
 * Each probe is independent, parallel-safe, time-boxed, and never throws.
 * Result shape:
 *   {
 *     name:       'cosmos' | 'plunk' | 'twilio' | 'vipps' | 'azure' | 'self',
 *     status:     'ok' | 'degraded' | 'down' | 'unknown',
 *     latencyMs:  number,
 *     message:    string,            // short human-readable summary (Norwegian)
 *     details:    object,            // probe-specific extra context
 *     env:        Record<string, boolean>  // boolean presence of relevant env vars
 *   }
 */

const PROBE_TIMEOUT_MS = 5000;

/**
 * Wrap an async probe with a timeout. Always resolves; never throws.
 * @param {string} name
 * @param {() => Promise<object>} fn
 * @param {number} [timeoutMs]
 */
const withTimeout = async (name, fn, timeoutMs = PROBE_TIMEOUT_MS) => {
    const startedAt = Date.now();
    let timer;
    try {
        const result = await Promise.race([
            fn(),
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`Probe '${name}' timet ut etter ${timeoutMs} ms`)),
                    timeoutMs
                );
            })
        ]);
        return {
            name,
            latencyMs: Date.now() - startedAt,
            status: 'ok',
            message: 'OK',
            details: {},
            env: {},
            ...result
        };
    } catch (err) {
        return {
            name,
            status: 'down',
            latencyMs: Date.now() - startedAt,
            message: err && err.message ? err.message : String(err),
            details: { errorName: err && err.name },
            env: {}
        };
    } finally {
        clearTimeout(timer);
    }
};

/**
 * fetch() with an AbortController-backed timeout (independent of withTimeout
 * so we can return a controlled "down" status with a useful message).
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = PROBE_TIMEOUT_MS - 500) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
};

// ─── Cosmos DB ─────────────────────────────────────────────────────────────
const probeCosmos = () => withTimeout('cosmos', async () => {
    const env = {
        COSMOS_ENDPOINT: !!process.env.COSMOS_ENDPOINT,
        COSMOS_CONNECTION_STRING: !!process.env.COSMOS_CONNECTION_STRING,
        COSMOS_DATABASE_ID: !!process.env.COSMOS_DATABASE_ID,
        COSMOS_CONTAINER_ID: !!process.env.COSMOS_CONTAINER_ID
    };

    let cosmosDb;
    try {
        cosmosDb = require('./cosmosDb');
    } catch (err) {
        return {
            status: 'down',
            message: 'Kunne ikke laste cosmosDb-modulen',
            details: { error: err.message },
            env
        };
    }

    const db = cosmosDb.initCosmosClient && cosmosDb.initCosmosClient();
    if (!db) {
        // Falling back to in-memory store. In production this is critical.
        const isProd = process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production';
        return {
            status: isProd ? 'down' : 'degraded',
            message: isProd
                ? 'Cosmos er ikke konfigurert — kjører på flyktig in-memory lager!'
                : 'Cosmos ikke konfigurert — bruker in-memory lager (lokal utvikling).',
            details: { mode: 'in-memory' },
            env
        };
    }

    // Cheap, indexed read. COUNT is server-side and stays under 1 RU on small containers.
    const querySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.type = @t',
        parameters: [{ name: '@t', value: 'booking' }]
    };
    const { resources, requestCharge } = await db.container.items.query(querySpec).fetchAll();
    const count = Array.isArray(resources) && resources.length ? resources[0] : 0;

    return {
        status: 'ok',
        message: `Cosmos OK — ${count} bookinger i container`,
        details: {
            database: process.env.COSMOS_DATABASE_ID || 'bjorkvang',
            container: process.env.COSMOS_CONTAINER_ID || 'bjorkvang',
            bookingCount: count,
            requestCharge: requestCharge || null
        },
        env
    };
});

// ─── Plunk (e-post) ────────────────────────────────────────────────────────
const probePlunk = () => withTimeout('plunk', async () => {
    const env = {
        PLUNK_API_TOKEN: !!process.env.PLUNK_API_TOKEN,
        DEFAULT_FROM_ADDRESS: !!process.env.DEFAULT_FROM_ADDRESS,
        BOARD_TO_ADDRESS: !!process.env.BOARD_TO_ADDRESS
    };

    if (!process.env.PLUNK_API_TOKEN) {
        return {
            status: 'unknown',
            message: 'PLUNK_API_TOKEN ikke satt — kan ikke verifisere',
            env
        };
    }

    // Probe Plunk's API host without sending mail. We expect a JSON response;
    // 200/401/404 all confirm the host is reachable. Only network errors / 5xx
    // indicate an outage.
    const response = await fetchWithTimeout('https://api.useplunk.com/', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.PLUNK_API_TOKEN}` }
    });

    if (response.status >= 500) {
        return {
            status: 'down',
            message: `Plunk API feilet med ${response.status}`,
            details: { httpStatus: response.status },
            env
        };
    }

    return {
        status: 'ok',
        message: 'Plunk API tilgjengelig',
        details: { httpStatus: response.status },
        env
    };
});

// ─── Twilio (SMS) ──────────────────────────────────────────────────────────
const probeTwilio = () => withTimeout('twilio', async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const env = {
        TWILIO_ACCOUNT_SID: !!sid,
        TWILIO_AUTH_TOKEN: !!token,
        SMS_SENDER_ID: !!process.env.SMS_SENDER_ID,
        BOARD_PHONE_NUMBER: !!process.env.BOARD_PHONE_NUMBER
    };

    if (!sid || !token) {
        return {
            status: 'unknown',
            message: 'Twilio er ikke konfigurert (mangler SID/token)',
            env
        };
    }

    // Read-only Account fetch — billed at 0 USD, confirms creds + connectivity.
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const response = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
        { method: 'GET', headers: { 'Authorization': `Basic ${auth}` } }
    );

    if (response.status === 401 || response.status === 403) {
        return {
            status: 'down',
            message: 'Twilio avviste credentials (401/403)',
            details: { httpStatus: response.status },
            env
        };
    }
    if (!response.ok) {
        return {
            status: 'down',
            message: `Twilio API feilet med ${response.status}`,
            details: { httpStatus: response.status },
            env
        };
    }

    let accountStatus = null;
    try {
        const body = await response.json();
        accountStatus = body && body.status;
    } catch (_) { /* ignore */ }

    return {
        status: accountStatus && accountStatus !== 'active' ? 'degraded' : 'ok',
        message: accountStatus
            ? `Twilio-konto: ${accountStatus}`
            : 'Twilio API tilgjengelig',
        details: { httpStatus: response.status, accountStatus, sender: process.env.SMS_SENDER_ID || 'Bjorkvang' },
        env
    };
});

// ─── Vipps ─────────────────────────────────────────────────────────────────
const probeVipps = () => withTimeout('vipps', async () => {
    const env = {
        VIPPS_CLIENT_ID: !!process.env.VIPPS_CLIENT_ID,
        VIPPS_CLIENT_SECRET: !!process.env.VIPPS_CLIENT_SECRET,
        VIPPS_SUBSCRIPTION_KEY: !!process.env.VIPPS_SUBSCRIPTION_KEY,
        VIPPS_MERCHANT_SERIAL_NUMBER: !!process.env.VIPPS_MERCHANT_SERIAL_NUMBER,
        VIPPS_BASE_URL: !!process.env.VIPPS_BASE_URL
    };

    if (!env.VIPPS_CLIENT_ID || !env.VIPPS_CLIENT_SECRET || !env.VIPPS_SUBSCRIPTION_KEY) {
        return {
            status: 'unknown',
            message: 'Vipps er ikke fullt konfigurert',
            env
        };
    }

    let vipps;
    try {
        vipps = require('./vipps');
    } catch (err) {
        return { status: 'down', message: `Vipps-modul feilet å laste: ${err.message}`, env };
    }

    const baseUrl = vipps.VIPPS_BASE_URL || process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no';
    const environment = baseUrl.includes('apitest') ? 'test' : 'production';

    const token = await vipps.getAccessToken();
    if (!token) {
        return { status: 'down', message: 'Vipps returnerte ingen access token', env, details: { environment } };
    }

    return {
        status: 'ok',
        message: `Vipps (${environment}) — access token mottatt`,
        details: { environment, baseUrl },
        env
    };
});

// ─── Azure Service Health ──────────────────────────────────────────────────
const probeAzureStatus = () => withTimeout('azure', async () => {
    // Public RSS feed — no auth, no rate limit issues at this volume.
    const response = await fetchWithTimeout(
        'https://azurestatuscdn.azureedge.net/en-us/status/feed/',
        { method: 'GET', headers: { 'Accept': 'application/rss+xml' } }
    );

    if (!response.ok) {
        return {
            status: 'unknown',
            message: `Azure status-feed svarte ${response.status}`,
            details: { httpStatus: response.status },
            env: {}
        };
    }

    const xml = await response.text();
    // Lightweight regex parse — feed is small (<200 KB) and well-formed.
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;

    const RELEVANT_REGIONS = /(west europe|north europe|global|all regions)/i;
    const RELEVANT_SERVICES = /(cosmos|functions|app service|azure ad|managed identity|active directory)/i;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const incidents = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const titleMatch = titleRegex.exec(block);
        const pubMatch = pubDateRegex.exec(block);
        if (!titleMatch) continue;

        const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const pubDate = pubMatch ? new Date(pubMatch[1].trim()).getTime() : 0;

        if (pubDate && pubDate < cutoff) continue;
        if (!RELEVANT_REGIONS.test(title) && !RELEVANT_SERVICES.test(title)) continue;

        incidents.push({ title, pubDate: pubMatch ? pubMatch[1].trim() : null });
        if (incidents.length >= 5) break;
    }

    if (incidents.length === 0) {
        return {
            status: 'ok',
            message: 'Ingen relevante Azure-hendelser siste 24 t',
            details: { feedItemsScanned: xml.match(itemRegex) ? xml.match(itemRegex).length : 0 },
            env: {}
        };
    }

    return {
        status: 'degraded',
        message: `${incidents.length} relevante Azure-hendelser siste 24 t`,
        details: { incidents },
        env: {}
    };
});

// ─── Function App selv ─────────────────────────────────────────────────────
const probeSelf = () => withTimeout('self', async () => {
    let pkgVersion = null;
    try { pkgVersion = require('../package.json').version; } catch (_) { /* ignore */ }

    const mem = process.memoryUsage();
    const uptimeSec = Math.round(process.uptime());
    return {
        status: 'ok',
        message: `Function App oppe i ${uptimeSec}s`,
        details: {
            nodeVersion: process.version,
            packageVersion: pkgVersion,
            uptimeSec,
            memoryRssMb: Math.round(mem.rss / 1024 / 1024),
            memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            environment: process.env.AZURE_FUNCTIONS_ENVIRONMENT || 'unknown',
            region: process.env.REGION_NAME || null
        },
        env: {
            ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
            PUBLIC_FUNCTION_BASE_URL: !!process.env.PUBLIC_FUNCTION_BASE_URL
        }
    };
});

// ─── Run all probes ────────────────────────────────────────────────────────
const ALL_PROBES = [probeCosmos, probePlunk, probeTwilio, probeVipps, probeAzureStatus, probeSelf];

/**
 * Run every probe in parallel. Always resolves with one entry per probe
 * (Promise.allSettled ensures one bad apple cannot break the response).
 */
const runAllProbes = async () => {
    const settled = await Promise.allSettled(ALL_PROBES.map((fn) => fn()));
    return settled.map((s, idx) => {
        if (s.status === 'fulfilled') return s.value;
        return {
            name: ALL_PROBES[idx].name || `probe_${idx}`,
            status: 'down',
            latencyMs: 0,
            message: s.reason && s.reason.message ? s.reason.message : 'Ukjent feil',
            details: {},
            env: {}
        };
    });
};

const STATUS_RANK = { ok: 0, unknown: 1, degraded: 2, down: 3 };

/**
 * Pick the worst status across probes for the top-level summary.
 */
const aggregateStatus = (probes) =>
    probes.reduce((worst, p) => (STATUS_RANK[p.status] > STATUS_RANK[worst] ? p.status : worst), 'ok');

module.exports = {
    runAllProbes,
    aggregateStatus,
    PROBE_TIMEOUT_MS
};
