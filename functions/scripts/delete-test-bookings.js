/**
 * One-off script to delete test bookings from CosmosDB.
 * Run from the functions/ directory:
 *   node scripts/delete-test-bookings.js
 */

const path = require('path');
const settings = require(path.join(__dirname, '../../functions/local.settings.json'));
Object.assign(process.env, settings.Values || {});

const { CosmosClient } = require('@azure/cosmos');

const CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING
    || (() => { throw new Error('COSMOS_CONNECTION_STRING not set'); })();
const DATABASE_ID  = process.env.COSMOS_DATABASE_ID  || 'bjorkvang';
const CONTAINER_ID = process.env.COSMOS_CONTAINER_ID || 'bjorkvang';

const IDS_TO_DELETE = [
    'booking-1776357574187-k0gz8j4',
    'booking-1776357790626-buqmy4i',
    'booking-1777918380841-gujziew',
    'booking-1777534721264-jo1ku8h',
    'booking-1777525051775-2kblwz3',
    'booking-1777357211602-0upqlgd',
    'booking-1777357417084-msoteyz',
    'booking-1777792598180-k1ewqug',
    'booking-1777534322212-8qjgxtl',
    'booking-1777894111418-7ckjtmc',
    'booking-1777524944299-8lqtxy7',
    'booking-1777524952912-y98uzw6',
    'booking-1777525007219-mp8uh8d',
    'booking-1777525008084-17vblhc',
    'booking-1777525008750-ifopd1t',
    'booking-1777438045744-mfz233y',
    // Approved test bookings
    'booking-1775286903998-r7fd4ur',
    'booking-1775971634612-28nfxrg',
    'booking-1776357738315-0ipzk9o',
    'booking-1777881540567-pkbpmi9',
    'booking-1778242501821-iuykwci',
    'booking-1777989604962-ujz7w8s',
];

async function main() {
    const client = new CosmosClient(CONNECTION_STRING);
    const container = client.database(DATABASE_ID).container(CONTAINER_ID);

    let deleted = 0;
    let notFound = 0;
    let failed = 0;

    for (const id of IDS_TO_DELETE) {
        try {
            // Partition key is first 7 chars of the date portion: YYYY-MM
            // Derive from the timestamp embedded in the id, or just query first
            const { resources } = await container.items.query({
                query: 'SELECT c.id, c.bjorkvang FROM c WHERE c.id = @id',
                parameters: [{ name: '@id', value: id }]
            }).fetchAll();

            if (!resources.length) {
                console.log(`NOT FOUND: ${id}`);
                notFound++;
                continue;
            }

            const partitionKey = resources[0].bjorkvang;
            await container.item(id, partitionKey).delete();
            console.log(`DELETED:   ${id}  (pk: ${partitionKey})`);
            deleted++;
        } catch (err) {
            console.error(`FAILED:    ${id}  — ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone. Deleted: ${deleted}  Not found: ${notFound}  Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
