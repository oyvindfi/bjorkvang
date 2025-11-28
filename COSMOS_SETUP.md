# Cosmos DB Setup Guide for Bjørkvang

## Current Status
✅ Cosmos DB NoSQL account created: `bjorkvang`  
✅ Endpoint: `https://bjorkvang.documents.azure.com:443/`  
✅ Database: `bjorkvang`  
✅ Container: `bjorkvang`  
✅ Partition key: `/bjorkvang`

## Secure Authentication Setup (No Keys in Code!)

### Option 1: Managed Identity (Recommended for Production)

#### Step 1: Enable Managed Identity on Azure Function App
```bash
# In Azure Portal or via Azure CLI
az functionapp identity assign \
  --name bjorkvang-duhsaxahgfe0btgv \
  --resource-group <your-resource-group>

# Note the "principalId" from the output
```

#### Step 2: Grant Cosmos DB Access to Managed Identity
```bash
# Get the principal ID from Step 1
PRINCIPAL_ID="<principal-id-from-step-1>"

# Assign Cosmos DB Data Contributor role
az cosmosdb sql role assignment create \
  --account-name bjorkvang \
  --resource-group <your-resource-group> \
  --scope "/" \
  --principal-id $PRINCIPAL_ID \
  --role-definition-id 00000000-0000-0000-0000-000000000002
```

#### Step 3: Set Environment Variables in Function App
In Azure Portal → Function App → Configuration → Application Settings:
```
COSMOS_ENDPOINT=https://bjorkvang.documents.azure.com:443/
COSMOS_DATABASE_ID=bjorkvang
COSMOS_CONTAINER_ID=bjorkvang
```

**No COSMOS_CONNECTION_STRING needed in production!**

### Option 2: Local Development (Connection String)

For local testing, add to `local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://bjorkvang.documents.azure.com:443/;AccountKey=<YOUR_KEY_HERE>;",
    "COSMOS_DATABASE_ID": "bjorkvang",
    "COSMOS_CONTAINER_ID": "bjorkvang"
  }
}
```

**Never commit `local.settings.json` to git!**

## Install Dependencies

```bash
cd functions
npm install
```

This will install:
- `@azure/cosmos` - Cosmos DB SDK
- `@azure/identity` - Managed Identity support

## Usage in Your Functions

### Example: Save a booking
```javascript
const { saveBooking } = require('../shared/cosmosDb');

const booking = {
    id: 'booking-123',
    date: '2025-12-15',
    time: '14:00',
    requesterName: 'Ola Nordmann',
    requesterEmail: 'ola@example.com',
    status: 'pending'
};

const saved = await saveBooking(booking);
```

### Example: Get a booking
```javascript
const { getBooking } = require('../shared/cosmosDb');

// Fast read with partition key
const booking = await getBooking('booking-123', '2025-12');

// Slower cross-partition read (no partition key)
const booking = await getBooking('booking-123');
```

### Example: Update status
```javascript
const { updateBookingStatus } = require('../shared/cosmosDb');

const updated = await updateBookingStatus('booking-123', '2025-12', 'approved');
```

### Example: List bookings
```javascript
const { listBookings } = require('../shared/cosmosDb');

// All bookings
const all = await listBookings();

// Date range
const december = await listBookings({
    startDate: '2025-12-01',
    endDate: '2025-12-31'
});
```

## Next Steps

1. **Install dependencies**: `cd functions && npm install`
2. **Enable Managed Identity** on your Function App
3. **Grant Cosmos DB access** to the Managed Identity
4. **Set environment variables** in Azure Portal
5. **Update your functions** to use `cosmosDb.js` instead of `bookingStore.js`
6. **Test locally** with connection string in `local.settings.json`
7. **Deploy** and verify it works with Managed Identity

## Migration Path

Replace in-memory `bookingStore.js` with `cosmosDb.js`:

```javascript
// Old (in-memory)
const { createBooking } = require('../shared/bookingStore');

// New (Cosmos DB)
const { saveBooking } = require('../shared/cosmosDb');
```

## Security Benefits

✅ **No keys in code** - Uses Managed Identity  
✅ **Automatic key rotation** - Azure handles it  
✅ **Fine-grained permissions** - RBAC control  
✅ **Audit logging** - Track all database access  
✅ **No secrets in git** - Zero risk of key leakage

## Partition Key Strategy

Using `/bjorkvang` with value = `YYYY-MM` format:
- **Good**: Groups bookings by month
- **Good**: Efficient queries within a month
- **Limitation**: Cross-month queries span partitions (slower but still works)

## Cost Estimate

With serverless mode:
- **Storage**: ~$0.25/GB/month (first 25GB free)
- **Reads**: ~$0.25 per million operations
- **Writes**: ~$1.25 per million operations
- **Expected**: $2-5/month for Bjørkvang's traffic
