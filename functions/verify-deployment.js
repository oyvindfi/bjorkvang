/**
 * Deployment verification script
 * Usage: node verify-deployment.js [local|production]
 */

const mode = process.argv[2] || 'production';
const isLocal = mode === 'local';

if (isLocal) {
    // Load from local.settings.json Values section
    try {
        const settings = require('./local.settings.json');
        Object.keys(settings.Values || {}).forEach(key => {
            process.env[key] = settings.Values[key];
        });
    } catch (error) {
        console.log('⚠️  Could not load local.settings.json');
    }
}

const fs = require('fs');

console.log(`🔍 Verifying ${mode.toUpperCase()} ${isLocal ? 'TESTING' : 'DEPLOYMENT'} readiness...\n`);

let allValid = true;

if (isLocal) {
    // For local testing, check that environment variables are configured
    console.log('📋 Checking local environment variables:');
    const requiredEnvVars = [
        'PLUNK_API_TOKEN',
        'BOARD_TO_ADDRESS', 
        'DEFAULT_FROM_ADDRESS'
    ];

    requiredEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (!value || value.includes('<YOUR_') || value.includes('example.com')) {
            console.log(`❌ ${varName}: Missing or placeholder value`);
            allValid = false;
        } else {
            console.log(`✅ ${varName}: Configured`);
        }
    });

    // Check Cosmos DB configuration for local
    console.log('\n🌍 Checking local Cosmos DB configuration:');
    if (process.env.COSMOS_CONNECTION_STRING || process.env.COSMOS_ENDPOINT) {
        console.log('✅ Cosmos DB: Connection configured');
    } else {
        console.log('❌ Cosmos DB: No connection configuration found');
        allValid = false;
    }
} else {
    // For production, just verify the code structure (env vars set in Azure Portal)
    console.log('📋 Production deployment verification:');
    console.log('✅ Environment variables will be configured in Azure Portal');
    console.log('✅ Cosmos DB will use Managed Identity in production');
}

// Verify package.json
console.log('\n📦 Verifying package.json:');
try {
    const pkg = require('./package.json');
    const requiredDeps = ['@azure/cosmos', '@azure/functions', '@azure/identity'];
    const missing = requiredDeps.filter(dep => !pkg.dependencies[dep]);
    
    if (missing.length === 0) {
        console.log('✅ All required dependencies present');
    } else {
        console.log(`❌ Missing dependencies: ${missing.join(', ')}`);
        allValid = false;
    }
} catch (error) {
    console.log('❌ Failed to read package.json');
    allValid = false;
}

// Check function files
console.log('\n📁 Verifying function files:');
const functionFiles = [
    'src/functions/bookingRequest.js',
    'src/functions/getCalendar/index.js',
    'src/functions/getAdminCalendar/index.js', 
    'src/functions/approveBooking/index.js',
    'src/functions/rejectBooking/index.js',
    'src/functions/emailHttpTriggerBooking/index.js',
    'shared/cosmosDb.js',
    'shared/email.js',
    'shared/http.js'
];

functionFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} not found`);
        allValid = false;
    }
});

console.log('\n' + '='.repeat(50));
if (allValid) {
    console.log('✅ All checks passed!');
    
    if (isLocal) {
        console.log('\nReady for local testing!');
        console.log('Next steps:');
        console.log('1. Run: npm start');
        console.log('2. Run: npm test (in another terminal)');
    } else {
        console.log('\nReady for production deployment!');
        console.log('Next steps:');
        console.log('1. Deploy: func azure functionapp publish <app-name>');
        console.log('2. Configure environment variables in Azure Portal:');
        console.log('   - PLUNK_API_TOKEN');
        console.log('   - BOARD_TO_ADDRESS');
        console.log('   - DEFAULT_FROM_ADDRESS');
        console.log('   - COSMOS_ENDPOINT');
        console.log('3. Enable Managed Identity and grant Cosmos DB access');
    }
    process.exit(0);
} else {
    console.log(`❌ ${mode} verification failed!`);
    console.log('Please fix the issues above.');
    process.exit(1);
}