/**
 * Simple verification that all Azure Functions import Cosmos DB correctly
 * Checks that files have been updated and can be loaded without errors
 */

console.log('\n🔍 Verifying Cosmos DB Integration...\n');

const results = [];

// Test 1: Check cosmosDb.js exists and exports functions
try {
    const cosmosDb = require('./shared/cosmosDb');
    const expectedExports = ['saveBooking', 'getBooking', 'updateBookingStatus', 'listBookings', 'deleteBooking'];
    const actualExports = Object.keys(cosmosDb);
    
    const allPresent = expectedExports.every(exp => actualExports.includes(exp));
    
    if (allPresent) {
        console.log('✅ cosmosDb.js exports all required functions');
        console.log(`   Functions: ${expectedExports.join(', ')}`);
        results.push(true);
    } else {
        console.log('❌ cosmosDb.js missing some exports');
        console.log(`   Expected: ${expectedExports.join(', ')}`);
        console.log(`   Found: ${actualExports.join(', ')}`);
        results.push(false);
    }
} catch (error) {
    console.log('❌ Failed to load cosmosDb.js');
    console.log(`   Error: ${error.message}`);
    results.push(false);
}

console.log('');

// Test 2-6: Check each Azure Function imports cosmosDb
const functions = [
    { name: 'bookingRequest', path: './src/functions/bookingRequest.js', imports: ['saveBooking'] },
    { name: 'getCalendar', path: './src/functions/getCalendar/index.js', imports: ['listBookings'] },
    { name: 'getAdminCalendar', path: './src/functions/getAdminCalendar/index.js', imports: ['listBookings'] },
    { name: 'approveBooking', path: './src/functions/approveBooking/index.js', imports: ['getBooking', 'updateBookingStatus'] },
    { name: 'rejectBooking', path: './src/functions/rejectBooking/index.js', imports: ['getBooking', 'updateBookingStatus'] }
];

const fs = require('fs');

functions.forEach(func => {
    try {
        const content = fs.readFileSync(func.path, 'utf-8');
        
        // Check if it imports from cosmosDb
        if (content.includes("require('../../shared/cosmosDb')") || content.includes("require('../../../shared/cosmosDb')")) {
            // Check if it imports the expected functions
            const hasAllImports = func.imports.every(imp => content.includes(imp));
            
            if (hasAllImports) {
                console.log(`✅ ${func.name} correctly imports Cosmos DB`);
                console.log(`   Imports: ${func.imports.join(', ')}`);
                results.push(true);
            } else {
                console.log(`⚠️  ${func.name} imports Cosmos DB but missing some functions`);
                console.log(`   Expected: ${func.imports.join(', ')}`);
                results.push(false);
            }
        } else if (content.includes("require('../../shared/bookingStore')") || content.includes("require('../../../shared/bookingStore')")) {
            console.log(`❌ ${func.name} still imports bookingStore (not migrated)`);
            results.push(false);
        } else {
            console.log(`❌ ${func.name} doesn't import storage module`);
            results.push(false);
        }
    } catch (error) {
        console.log(`❌ Failed to check ${func.name}`);
        console.log(`   Error: ${error.message}`);
        results.push(false);
    }
});

console.log('');

// Test 7: Check for await usage (async calls)
console.log('🔍 Checking for async/await usage...\n');

functions.forEach(func => {
    try {
        const content = fs.readFileSync(func.path, 'utf-8');
        
        // Check if functions are called with await
        const hasAwait = func.imports.some(imp => {
            const regex = new RegExp(`await\\s+${imp}\\s*\\(`);
            return regex.test(content);
        });
        
        if (hasAwait) {
            console.log(`✅ ${func.name} uses await for async Cosmos DB calls`);
            results.push(true);
        } else {
            console.log(`⚠️  ${func.name} may not be using await (check manually)`);
            results.push(false);
        }
    } catch (error) {
        console.log(`❌ Failed to check ${func.name} for await usage`);
        results.push(false);
    }
});

console.log('');

// Summary
const totalTests = results.length;
const passedTests = results.filter(r => r).length;

console.log('='.repeat(60));
if (passedTests === totalTests) {
    console.log(`✅ All checks passed! (${passedTests}/${totalTests})`);
    console.log('');
    console.log('🎉 Integration is complete and ready for testing!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: node test-cosmos.js (to test Cosmos DB directly)');
    console.log('2. Run: npm start (to start Azure Functions)');
    console.log('3. Run: npm test (to test all endpoints)');
} else {
    console.log(`⚠️  ${passedTests}/${totalTests} checks passed`);
    console.log('');
    console.log('Some issues were found. Please review the output above.');
}
console.log('='.repeat(60));
console.log('');

process.exit(passedTests === totalTests ? 0 : 1);
