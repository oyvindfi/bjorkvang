/**
 * One-off script to delete ALL bookings from CosmosDB (go-live cleanup).
 * Run from the functions/ directory:
 *   node scripts/delete-all-bookings.js
 *
 * Requires confirmation prompt before proceeding.
 */

const path = require('path');
const readline = require('readline');
const settings = require(path.join(__dirname, '../../functions/local.settings.json'));
Object.assign(process.env, settings.Values || {});

const { CosmosClient } = require('@azure/cosmos');

const CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING
    || (() => { throw new Error('COSMOS_CONNECTION_STRING not set'); })();
const DATABASE_ID  = process.env.COSMOS_DATABASE_ID  || 'bjorkvang';
const CONTAINER_ID = process.env.COSMOS_CONTAINER_ID || 'bjorkvang';

async function confirm(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
    });
}

async function main() {
    const client = new CosmosClient(CONNECTION_STRING);
    const container = client.database(DATABASE_ID).container(CONTAINER_ID);

    // Fetch all booking items (only id + partition key)
    const { resources } = await container.items.query({
        query: 'SELECT c.id, c.bjorkvang FROM c WHERE c.type = "booking"'
    }).fetchAll();

    if (resources.length === 0) {
        console.log('No bookings found. Nothing to delete.');
        return;
    }

    console.log(`Found ${resources.length} booking(s):`);
    resources.forEach(r => console.log(`  ${r.id}  (pk: ${r.bjorkvang})`));

    const answer = await confirm(`\nSlett alle ${resources.length} bookinger? Skriv "ja" for å bekrefte: `);
    if (answer.toLowerCase() !== 'ja') {
        console.log('Avbrutt. Ingen bookinger slettet.');
        return;
    }

    let deleted = 0;
    let failed  = 0;

    for (const { id, bjorkvang } of resources) {
        try {
            await container.item(id, bjorkvang).delete();
            console.log(`DELETED: ${id}`);
            deleted++;
        } catch (err) {
            console.error(`FAILED:  ${id} — ${err.message}`);
            failed++;
        }
    }

    console.log(`\nFerdig. Slettet: ${deleted}  Feilet: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
