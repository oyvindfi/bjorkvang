const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const inMemoryStore = require('./bookingStore');

// Configuration from environment variables
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_DATABASE_ID = process.env.COSMOS_DATABASE_ID || 'bjorkvang';
const COSMOS_CONTAINER_ID = process.env.COSMOS_CONTAINER_ID || 'bjorkvang';
const COSMOS_CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING;

let client = null;
let database = null;
let container = null;
let useInMemory = false;

/**
 * Initialize Cosmos DB client with Managed Identity (no keys needed).
 * Falls back to connection string for local development.
 */
const initCosmosClient = () => {
    if (useInMemory) {
        return null;
    }

    if (client) {
        return { database, container };
    }

    // Check if we have enough config to even try Cosmos
    if (!COSMOS_CONNECTION_STRING && !COSMOS_ENDPOINT) {
        if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production') {
            throw new Error('CosmosDB: Critical configuration missing in Production (COSMOS_ENDPOINT or COSMOS_CONNECTION_STRING).');
        }
        console.log('CosmosDB: No configuration found. Falling back to in-memory store.');
        useInMemory = true;
        return null;
    }

    console.log('CosmosDB: Initializing client...');
    try {
        if (COSMOS_CONNECTION_STRING) {
            // Local development mode: use connection string
            console.log('CosmosDB: Using connection string for local development');
            client = new CosmosClient(COSMOS_CONNECTION_STRING);
        } else {
            // Production mode: use Managed Identity
            console.log('CosmosDB: Using Managed Identity');
            const credential = new DefaultAzureCredential();
            client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
        }

        database = client.database(COSMOS_DATABASE_ID);
        container = database.container(COSMOS_CONTAINER_ID);
        console.log(`CosmosDB: Client initialized for ${COSMOS_DATABASE_ID}/${COSMOS_CONTAINER_ID}`);
        
        return { database, container };
    } catch (error) {
        if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production') {
            console.error('CosmosDB: Critical initialization failure in Production', error);
            throw error; // Fail hard in production to avoid data loss
        }
        console.error('CosmosDB: Failed to initialize client, falling back to in-memory store', error);
        useInMemory = true;
        return null;
    }
};

/**
 * Save a booking to Cosmos DB or in-memory store.
 * @param {Object} booking - Booking object with id, date, time, etc.
 * @returns {Promise<Object>} The created booking resource
 */
const saveBooking = async (booking) => {
    try {
        console.log('saveBooking called', { id: booking.id });
        const db = initCosmosClient();
        
        if (useInMemory || !db) {
            console.log('Using in-memory store for saveBooking');
            return inMemoryStore.createBooking(booking);
        }

        const { container } = db;
        
        // Add partition key field (using first 7 chars of date: YYYY-MM)
        const item = {
            ...booking,
            bjorkvang: booking.date ? booking.date.substring(0, 7) : new Date().toISOString().substring(0, 7),
            createdAt: booking.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        console.log('CosmosDB: Creating item in container...', { id: item.id, partitionKey: item.bjorkvang });
        const { resource } = await container.items.create(item);
        console.log(`CosmosDB: Saved booking ${resource.id}`);
        return resource;
    } catch (error) {
        console.error('Failed to save booking', {
            error: error.message,
            code: error.code,
            bookingId: booking.id
        });
        // Fallback to in-memory on error if not already using it? 
        // For now, let's just throw to avoid partial state confusion, 
        // unless it was a connection error which initCosmosClient should have caught.
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
        const db = initCosmosClient();

        if (useInMemory || !db) {
            return inMemoryStore.getBooking(id);
        }

        const { container } = db;
        
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
        const db = initCosmosClient();

        if (useInMemory || !db) {
            return inMemoryStore.updateBookingStatus(id, status);
        }

        const { container } = db;
        
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
 * Add contract signature to a booking.
 * @param {string} id - Booking ID
 * @param {string} partitionKey - Partition key value
 * @param {Object} signatureInfo - Signature details (role, signatureData, signedAt, userAgent, ip)
 * @returns {Promise<Object|null>} Updated booking or null if not found
 */
const addContractSignature = async (id, partitionKey, signatureInfo) => {
    try {
        const db = initCosmosClient();
        
        // Get the existing booking first (needed for both in-memory and cosmos to merge)
        const existing = await getBooking(id, partitionKey);
        if (!existing) {
            return null;
        }

        // Prepare the new contract object
        const currentContract = existing.contract || {};
        let newContract = { ...currentContract };

        if (signatureInfo.role === 'landlord') {
            newContract.landlordSignedAt = signatureInfo.signedAt;
            newContract.landlordSignature = signatureInfo.signatureData;
            newContract.landlordIpAddress = signatureInfo.ipAddress;
            newContract.landlordUserAgent = signatureInfo.userAgent;
        } else {
            // Default to requester
            newContract.signedAt = signatureInfo.signedAt;
            newContract.requesterSignature = signatureInfo.signatureData;
            newContract.ipAddress = signatureInfo.ipAddress;
            newContract.userAgent = signatureInfo.userAgent;
        }

        if (useInMemory || !db) {
            // Mock implementation for in-memory
            existing.contract = newContract;
            return existing;
        }

        const { container } = db;
        
        // Update the booking
        const updated = {
            ...existing,
            contract: newContract,
            updatedAt: new Date().toISOString()
        };

        const { resource } = await container.item(id, partitionKey || existing.bjorkvang).replace(updated);
        console.log(`CosmosDB: Added signature to booking ${id} (Role: ${signatureInfo.role})`);
        return resource;
    } catch (error) {
        console.error('CosmosDB: Failed to add signature', {
            error: error.message,
            code: error.code,
            id
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
        const db = initCosmosClient();

        if (useInMemory || !db) {
            return inMemoryStore.listBookings();
        }

        const { container } = db;
        
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
        const db = initCosmosClient();

        if (useInMemory || !db) {
            // In-memory store doesn't have delete implemented in the file I read, 
            // but let's assume it might or we just skip it for now.
            // Checking bookingStore.js content again... it does NOT have delete.
            // We can add it or just return false.
            return false; 
        }

        const { container } = db;
        
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
    addContractSignature,
    listBookings,
    deleteBooking,
};
