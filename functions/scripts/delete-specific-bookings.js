/**
 * Delete specific bookings by ID from CosmosDB.
 * Run from the functions/ directory: node scripts/delete-specific-bookings.js
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
    'booking-1764431148596-7nb2vhy',
    'booking-1764445676330-ycr0pcz',
    'booking-1764573029102-nsqhas6',
    'test-booking-1764272333058',
    'booking-1764328894451-szatypr',
    'booking-1764330407253-t3rkc66',
    'booking-1764330433341-aqhqvnd',
    'booking-1764330518458-qku22yz',
    'booking-1764330597093-ryybn73',
    'booking-1764428620319-fqwg008',
    'booking-1771052841413-ua7hwex',
    'booking-1772256628195-xheouyj',
    'booking-1771874391234-cjz2ja1',
    'booking-1773478966201-7zjz893',
];

async function main() {
    const client = new CosmosClient(CONNECTION_STRING);
    const container = client.database(DATABASE_ID).container(CONTAINER_ID);

    // Fetch all bookings to build id→partitionKey map
    const { resources } = await container.items.query({
        query: 'SELECT c.id, c.bjorkvang FROM c WHERE c.type = "booking"'
    }).fetchAll();

    const pkMap = Object.fromEntries(resources.map(r => [r.id, r.bjorkvang]));

    let deleted = 0, failed = 0;
    for (const id of IDS_TO_DELETE) {
        const pk = pkMap[id];
        if (!pk) {
            console.log(`NOT FOUND: ${id}`);
            failed++;
            continue;
        }
        try {
            await container.item(id, pk).delete();
            console.log(`DELETED: ${id}`);
            deleted++;
        } catch (e) {
            console.log(`FAILED: ${id} — ${e.message}`);
            failed++;
        }
    }
    console.log(`\nFerdig. Slettet: ${deleted}  Feilet/ikke funnet: ${failed}`);
}

main().catch(console.error);
