#!/bin/bash

# Script to start Azure Functions and run integration tests

echo "============================================================"
echo "Bjørkvang Functions - Test Runner"
echo "============================================================"
echo ""

# Change to functions directory
cd "$(dirname "$0")" || exit 1

# Check if Azure Functions Core Tools are installed
if ! command -v func &> /dev/null; then
    echo "⚠️  Azure Functions Core Tools not found"
    echo "   Installing via npx (this may take a moment)..."
    echo ""
fi

# Start Azure Functions in the background
echo "🚀 Starting Azure Functions..."
if command -v func &> /dev/null; then
    func start &
else
    npx --yes azure-functions-core-tools@4 start &
fi

FUNC_PID=$!

# Wait for functions to start (check every second for 30 seconds)
echo "⏳ Waiting for functions to start..."
MAX_WAIT=30
COUNTER=0
FUNCTIONS_READY=false

while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s http://localhost:7071/api/booking/calendar > /dev/null 2>&1; then
        FUNCTIONS_READY=true
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
    echo -n "."
done

echo ""

if [ "$FUNCTIONS_READY" = false ]; then
    echo "❌ Functions failed to start within $MAX_WAIT seconds"
    echo "   Check the logs above for errors"
    kill $FUNC_PID 2>/dev/null
    exit 1
fi

echo "✅ Functions are ready!"
echo ""

# Run the tests
echo "🧪 Running integration tests..."
echo ""
node test-functions.js

TEST_EXIT_CODE=$?

# Stop the functions
echo ""
echo "🛑 Stopping Azure Functions..."
kill $FUNC_PID 2>/dev/null

# Wait for the process to die
sleep 2

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE
