# Testing Guide for Bjørkvang Functions

## Quick Start

### 1. Test Cosmos DB Connection (Direct)
Tests the Cosmos DB integration directly without running Azure Functions:

```bash
npm run test:cosmos
```

**What it tests:**
- ✅ Connection to Cosmos DB
- ✅ Save booking operation
- ✅ Read booking by ID
- ✅ Update booking status
- ✅ List all bookings
- ✅ List bookings by date range
- ✅ Delete booking

### 2. Test Azure Functions (Integration)
Tests all Azure Functions endpoints with Cosmos DB integration:

**First, start the functions:**
```bash
npm start
```

**Then, in a new terminal, run the tests:**
```bash
npm test
```

**What it tests:**
- ✅ POST `/api/booking` - Create new booking
- ✅ GET `/api/booking/calendar` - Public calendar (minimal info)
- ✅ GET `/api/booking/admin` - Admin calendar (full details)
- ✅ GET `/api/booking/approve?id=X` - Approve booking
- ✅ POST `/api/booking/reject?id=X` - Reject booking with reason
- ✅ Input validation (missing fields, invalid formats)

## Test Results

### Expected Output (test-cosmos.js)
```
🧪 Testing Cosmos DB Connection...

📝 Test 1: Creating a test booking...
✅ Booking saved: test-booking-xxx
   Partition key: 2025-12

🔍 Test 2: Retrieving the booking...
✅ Booking retrieved: test-booking-xxx
   Name: Test User
   Date: 2025-12-15

📋 Test 3: Updating booking status...
✅ Status updated to: approved

📚 Test 4: Listing all bookings...
✅ Found 1 total bookings

📅 Test 5: Listing December 2025 bookings...
✅ Found 1 bookings in December 2025

🗑️  Test 6: Cleaning up test booking...
✅ Test booking deleted successfully

✅ All tests completed successfully! 🎉
```

### Expected Output (test-functions.js)
```
============================================================
🧪 Azure Functions + Cosmos DB Integration Tests
============================================================

📝 Test 1: Creating a new booking...
✅ Booking created with ID: booking-xxx
   Status: pending

📝 Test 2: Fetching public calendar...
✅ Retrieved 1 bookings from public calendar
   Our booking found: 2025-12-20 at 14:00

📝 Test 3: Fetching admin calendar...
✅ Retrieved 1 bookings from admin calendar
   Our booking found:
   - Date: 2025-12-20 at 14:00
   - Name: Test Bruker
   - Email: test@example.com
   - Status: pending

📝 Test 4: Approving the booking...
✅ Booking approved successfully

📝 Test 5: Verifying booking status changed to approved...
✅ Booking status is now: approved

📝 Test 6: Creating and rejecting a second booking...
✅ Second booking rejected successfully
✅ Verified status is: rejected

📝 Test 7: Testing input validation...
✅    ✓ Missing required field (date)
✅    ✓ Invalid email format
✅    ✓ Invalid date format
✅    ✓ Invalid time format

============================================================
📊 Test Summary
============================================================

✅ Create Booking
✅ Get Public Calendar
✅ Get Admin Calendar
✅ Approve Booking
✅ Verify Approval
✅ Create and Reject Booking
✅ Input Validation

============================================================
✅ All tests passed! (7/7) 🎉
============================================================
```

## Manual Testing

### Create a Booking (cURL)
```bash
curl -X POST http://localhost:7071/api/booking \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-25",
    "time": "18:00",
    "requesterName": "Ola Nordmann",
    "requesterEmail": "ola@example.com",
    "message": "Ønsker å leie lokalet til julefest"
  }'
```

### Get Public Calendar
```bash
curl http://localhost:7071/api/booking/calendar
```

### Get Admin Calendar
```bash
curl http://localhost:7071/api/booking/admin
```

### Approve Booking
```bash
curl "http://localhost:7071/api/booking/approve?id=booking-xxx"
```

### Reject Booking with Reason
```bash
curl -X POST "http://localhost:7071/api/booking/reject?id=booking-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Lokalet er dessverre opptatt denne dagen"
  }'
```

## Troubleshooting

### "Connection refused" errors
- Make sure Azure Functions are running (`npm start`)
- Check that functions are listening on `http://localhost:7071`

### "Cannot find module" errors
- Run `npm install` to install dependencies
- Make sure you're in the `/functions` directory

### Cosmos DB connection errors
- Verify `COSMOS_CONNECTION_STRING` in `local.settings.json`
- Check that the connection string format is correct (no double equals `==`)
- Ensure Cosmos DB database and container exist:
  - Database: `bjorkvang`
  - Container: `bjorkvang`
  - Partition key: `/bjorkvang`

### Email not sending
- Verify `PLUNK_API_TOKEN` in `local.settings.json`
- Check `DEFAULT_FROM_ADDRESS` and `BOARD_TO_ADDRESS` are set
- Look for email errors in function logs

## Test Data Cleanup

After testing, you may want to clean up test bookings from Cosmos DB:

1. Go to Azure Portal → Cosmos DB → Data Explorer
2. Select `bjorkvang` database → `bjorkvang` container
3. Find and delete test bookings (IDs starting with `test-booking-` or `booking-`)

Or use the Azure CLI:
```bash
# List all bookings
az cosmosdb sql query -g bjørkvang -a bjorkvang -d bjorkvang -c bjorkvang --query-text "SELECT * FROM c"
```

## CI/CD Testing

For automated testing in CI/CD pipelines, use:

```bash
# Run Cosmos DB tests (requires connection string)
npm run test:cosmos

# Run integration tests (requires functions running)
npm start &  # Start functions in background
sleep 10     # Wait for functions to start
npm test     # Run integration tests
```
