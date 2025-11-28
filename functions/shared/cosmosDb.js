const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Configuration from environment variables
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://bjorkvang.documents.azure.com:443/';
const COSMOS_DATABASE_ID = process.env.COSMOS_DATABASE_ID || 'bjorkvang';
const COSMOS_CONTAINER_ID = process.env.COSMOS_CONTAINER_ID || 'bjorkvang';

let client = null;
let database = null;
let container = null;

/**
 * Initialize Cosmos DB client with Managed Identity (no keys needed).
 * Falls back to connection string for local development.
 */
const initCosmosClient = () => {
    if (client) {
        return { database, container };
    }

    try {
        // Check if running locally with connection string
        const connectionString = process.env.COSMOS_CONNECTION_STRING;
        
        if (connectionString) {
            // Local development mode: use connection string
            console.log('CosmosDB: Using connection string for local development');
            client = new CosmosClient(connectionString);
        } else {
            // Production mode: use Managed Identity (no keys!)
            console.log('CosmosDB: Using Managed Identity for authentication');
            const credential = new DefaultAzureCredential();
            client = new CosmosClient({
                endpoint: COSMOS_ENDPOINT,
                aadCredentials: credential
            });
        }

        database = client.database(COSMOS_DATABASE_ID);
        container = database.container(COSMOS_CONTAINER_ID);

        console.log(`CosmosDB: Connected to database '${COSMOS_DATABASE_ID}', container '${COSMOS_CONTAINER_ID}'`);
        return { database, container };
    } catch (error) {
        console.error('CosmosDB: Failed to initialize client', error);
        throw new Error(`Failed to connect to Cosmos DB: ${error.message}`);
    }
};

/**
 * Save a booking to Cosmos DB.
 * @param {Object} booking - Booking object with id, date, time, etc.
 * @returns {Promise<Object>} The created booking resource
 */
const saveBooking = async (booking) => {
    try {
        const { container } = initCosmosClient();
        
        // Add partition key field (using first 7 chars of date: YYYY-MM)
        const item = {
            ...booking,
            bjorkvang: booking.date ? booking.date.substring(0, 7) : new Date().toISOString().substring(0, 7),
            createdAt: booking.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const { resource } = await container.items.create(item);
        console.log(`CosmosDB: Saved booking ${resource.id}`);
        return resource;
    } catch (error) {
        console.error('CosmosDB: Failed to save booking', {
            error: error.message,
            code: error.code,
            bookingId: booking.id
        });
        throw error;
    }
};

/**
 * Get a single booking by ID.
 * @param {string} id - Booking ID
 * @param {string} partitionKey - Partition key value (date in YYYY-MM format)
 * @returns {Promise<Object|null>} The booking or null if not found
 */
const getBooking = async (id, partitionKey) => {
    try {
        const { container } = initCosmosClient();
        
        if (!partitionKey) {
            // If no partition key provided, query across all partitions (slower but works)
            const querySpec = {
                query: 'SELECT * FROM c WHERE c.id = @id',
                parameters: [{ name: '@id', value: id }]
            };
            const { resources } = await container.items.query(querySpec).fetchAll();
            return resources.length > 0 ? resources[0] : null;
        }

        // Fast point read with partition key
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    } catch (error) {
        if (error.code === 404) {
            return null;
        }
        console.error('CosmosDB: Failed to get booking', {
            error: error.message,
            code: error.code,
            id
        });
        throw error;
    }
};

/**
 * Update a booking's status.
 * @param {string} id - Booking ID
 * @param {string} partitionKey - Partition key value
 * @param {string} status - New status ('pending', 'approved', 'rejected')
 * @returns {Promise<Object|null>} Updated booking or null if not found
 */
const updateBookingStatus = async (id, partitionKey, status) => {
    try {
        const { container } = initCosmosClient();
        
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
        }

        // Get the existing booking first
        const existing = await getBooking(id, partitionKey);
        if (!existing) {
            return null;
        }

        // Update the booking
        const updated = {
            ...existing,
            status,
            updatedAt: new Date().toISOString()
        };

        const { resource } = await container.item(id, partitionKey || existing.bjorkvang).replace(updated);
        console.log(`CosmosDB: Updated booking ${id} status to ${status}`);
        return resource;
    } catch (error) {
        console.error('CosmosDB: Failed to update booking status', {
            error: error.message,
            code: error.code,
            id,
            status
        });
        throw error;
    }
};

/**
 * List all bookings, optionally filtered by date range.
 * @param {Object} options - Query options
 * @param {string} options.startDate - Optional start date filter (YYYY-MM-DD)
 * @param {string} options.endDate - Optional end date filter (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of bookings
 */
const listBookings = async ({ startDate, endDate } = {}) => {
    try {
        const { container } = initCosmosClient();
        
        let querySpec;
        
        // Note: ORDER BY removed from queries to avoid requiring composite index
        // Sorting is done client-side instead
        if (startDate && endDate) {
            querySpec = {
                query: 'SELECT * FROM c WHERE c.date >= @startDate AND c.date <= @endDate',
                parameters: [
                    { name: '@startDate', value: startDate },
                    { name: '@endDate', value: endDate }
                ]
            };
        } else if (startDate) {
            querySpec = {
                query: 'SELECT * FROM c WHERE c.date >= @startDate',
                parameters: [{ name: '@startDate', value: startDate }]
            };
        } else {
            querySpec = {
                query: 'SELECT * FROM c'
            };
        }

        const { resources } = await container.items.query(querySpec).fetchAll();
        
        // Sort client-side by date ASC, then time ASC
        const sorted = resources.sort((a, b) => {
            if (a.date === b.date) {
                return (a.time || '').localeCompare(b.time || '');
            }
            return a.date.localeCompare(b.date);
        });
        
        console.log(`CosmosDB: Retrieved ${sorted.length} bookings`);
        return sorted;
    } catch (error) {
        console.error('CosmosDB: Failed to list bookings', {
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

/**
 * Delete a booking (for cleanup or testing).
 * @param {string} id - Booking ID
 * @param {string} partitionKey - Partition key value
 * @returns {Promise<boolean>} True if deleted
 */
const deleteBooking = async (id, partitionKey) => {
    try {
        const { container } = initCosmosClient();
        
        const existing = await getBooking(id, partitionKey);
        if (!existing) {
            return false;
        }

        await container.item(id, partitionKey || existing.bjorkvang).delete();
        console.log(`CosmosDB: Deleted booking ${id}`);
        return true;
    } catch (error) {
        console.error('CosmosDB: Failed to delete booking', {
            error: error.message,
            code: error.code,
            id
        });
        throw error;
    }
};

module.exports = {
    saveBooking,
    getBooking,
    updateBookingStatus,
    listBookings,
    deleteBooking,
};
