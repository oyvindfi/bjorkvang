const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const fetch = require('node-fetch');

const PAGE_ID = '100064406991223';
const GRAPH_API_VERSION = 'v25.0';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const POST_LIMIT = 10;
const FIELDS = 'message,created_time,full_picture,permalink_url,attachments{media,subattachments}';

let cache = { data: null, timestamp: 0 };

function extractImages(attachments) {
    if (!attachments || !attachments.data) return [];
    const images = [];
    for (const att of attachments.data) {
        if (att.media && att.media.image) {
            images.push(att.media.image.src);
        }
        if (att.subattachments && att.subattachments.data) {
            for (const sub of att.subattachments.data) {
                if (sub.media && sub.media.image) {
                    images.push(sub.media.image.src);
                }
            }
        }
    }
    return images;
}

function sanitizePost(post) {
    return {
        id: post.id,
        message: post.message || '',
        createdTime: post.created_time,
        picture: post.full_picture || null,
        permalink: post.permalink_url || null,
        images: extractImages(post.attachments),
    };
}

app.http('getFacebookFeed', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'facebook/feed',
    handler: async (request, context) => {
        try {
            context.log('getFacebookFeed: Handling request');

            if (request.method === 'OPTIONS') {
                return createJsonResponse(204, {}, request);
            }

            const token = (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '').trim();
            if (!token) {
                context.log.warn('getFacebookFeed: FACEBOOK_PAGE_ACCESS_TOKEN not configured');
                return createJsonResponse(503, {
                    error: 'Facebook-integrasjon er ikke konfigurert.',
                }, request);
            }

            // Return cached data if still fresh
            const now = Date.now();
            if (cache.data && (now - cache.timestamp) < CACHE_TTL_MS) {
                context.log('getFacebookFeed: Returning cached data');
                return createJsonResponse(200, cache.data, request);
            }

            const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/posts`
                + `?fields=${FIELDS}&limit=${POST_LIMIT}&access_token=${token}`;

            const res = await fetch(url);
            const json = await res.json();

            if (!res.ok) {
                context.log.error('getFacebookFeed: Graph API error', {
                    status: res.status,
                    error: json.error ? json.error.message : JSON.stringify(json),
                });
                return createJsonResponse(502, {
                    error: 'Kunne ikke hente innlegg fra Facebook.',
                }, request);
            }

            const posts = (json.data || [])
                .filter(p => p.message || p.full_picture)
                .map(sanitizePost);

            const result = { posts, fetchedAt: new Date().toISOString() };
            cache = { data: result, timestamp: now };

            context.log(`getFacebookFeed: Fetched ${posts.length} posts from Graph API`);
            return createJsonResponse(200, result, request);

        } catch (error) {
            context.log.error('getFacebookFeed: Unhandled error', {
                error: error.message,
                stack: error.stack,
            });
            return createJsonResponse(502, {
                error: 'Kunne ikke hente innlegg fra Facebook.',
            }, request);
        }
    },
});
