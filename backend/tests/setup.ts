import { db, connectDB, disconnectDB } from '../src/db/mongo';

// Test database URL - uses a separate test database
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'mongodb://admin:password@localhost:27017/plataforma_acarreo_test?authSource=admin';

/**
 * Force index build to complete by doing a dummy insert/delete.
 * MongoDB's createIndex is asynchronous and returns before the index is built.
 * This workaround forces MongoDB to wait for the index to be ready before
 * the write operation completes, ensuring unique constraints are enforced.
 */
async function forceIndexBuild(nativeDb: any, collectionName: string, indexFields: Record<string, number>): Promise<void> {
  const dummyDoc: Record<string, string> = { _id: `__index_build_${Date.now()}__` };
  for (const key of Object.keys(indexFields)) {
    dummyDoc[key] = `__test_${key}__`;
  }
  try {
    await nativeDb.collection(collectionName).insertOne(dummyDoc);
    await nativeDb.collection(collectionName).deleteOne({ _id: dummyDoc._id });
  } catch {
    // Ignore errors - this is just to force index build
  }
}

export async function setupTests(): Promise<void> {
  // Set dummy env vars for tests that import modules with Stripe/Clerk
  process.env.STRIPE_SECRET_KEY ||= 'sk_test_dummy_for_tests';
  process.env.CLERK_SECRET_KEY ||= 'test_clerk_secret_key';

  // Set test database URL
  process.env.DATABASE_URL = TEST_DB_URL;
  await connectDB();

  // Create unique indexes using the native MongoDB driver with proper separation of key pattern and options
  // In MongoDB driver v4+, createIndex(keyPattern, options) - background must be in options object
  const nativeDb = db.db;
  if (nativeDb) {
    try {
      // Use explicit separate arguments: createIndex(keyPattern, optionsObject)
      // Then force index build with dummy insert/delete to ensure it's ready before tests run
      await nativeDb.collection('offers').createIndex(
        { rideId: 1, driverId: 1 },
        { unique: true }
      );
      await forceIndexBuild(nativeDb, 'offers', { rideId: 1, driverId: 1 });

      await nativeDb.collection('ratings').createIndex(
        { rideId: 1, raterId: 1, ratedId: 1, role: 1 },
        { unique: true }
      );
      await forceIndexBuild(nativeDb, 'ratings', { rideId: 1, raterId: 1, ratedId: 1, role: 1 });

      await nativeDb.collection('mcp_tokens').createIndex(
        { tokenId: 1 },
        { unique: true }
      );
      await forceIndexBuild(nativeDb, 'mcp_tokens', { tokenId: 1 });

      await nativeDb.collection('audit_logs').createIndex(
        { clerkId: 1 }
      );
      await forceIndexBuild(nativeDb, 'audit_logs', { clerkId: 1 });

      await nativeDb.collection('audit_logs').createIndex(
        { createdAt: -1 }
      );
      await forceIndexBuild(nativeDb, 'audit_logs', { createdAt: -1 });

      console.log('✅ Test indexes created');
    } catch (error) {
      // Index might already exist - that's fine, log and continue
      console.log('Index creation result (might already exist):', error);
    }
  } else {
    console.warn('⚠️ Native DB driver not available for index creation');
  }
}

export async function teardownTests(): Promise<void> {
  // Use deleteMany instead of drop() to PRESERVE indexes
  // Dropping collections removes indexes, which breaks the unique constraint tests
  const testCollections = ['offers', 'rides', 'users', 'drivers', 'ratings', 'messages', 'audit_logs', 'mcp_tokens'];
  try {
    for (const name of testCollections) {
      try {
        await db.collection(name).deleteMany({});
      } catch {
        // Collection might not exist, ignore
      }
    }
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
  await disconnectDB();
}

// Clean up a specific collection (preserves indexes - uses deleteMany, not drop)
export async function cleanupCollection(collectionName: string): Promise<void> {
  try {
    await db.collection(collectionName).deleteMany({});
  } catch (error) {
    console.error(`Error cleaning up ${collectionName}:`, error);
  }
}

// Create test data helpers
export async function createTestUser(clerkId: string, role: 'client' | 'driver' | 'admin' = 'client'): Promise<any> {
  const user = {
    clerkId,
    email: `${clerkId}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.collection('users').insertOne(user);
  return user;
}

export async function createTestDriver(userId: string, overrides: Partial<any> = {}): Promise<any> {
  const driver = {
    userId,
    vehicleType: 'camioneta',
    plate: 'ABC123',
    capacityKg: 1000,
    isAvailable: true,
    rating: 5.0,
    totalRides: 0,
    isVerified: true,
    verificationStatus: 'verified',
    phone: '+50712345678',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await db.collection('drivers').insertOne(driver);
  return driver;
}

export async function createTestRide(clientId: string, overrides: Partial<any> = {}): Promise<any> {
  const ride = {
    clientId,
    title: 'Test Ride',
    description: 'Test Description',
    type: 'mudanza',
    images: [],
    pickupLocation: {
      address: 'Test Pickup',
      type: 'Point',
      coordinates: [-79.5, 8.9]
    },
    dropoffLocation: {
      address: 'Test Dropoff',
      type: 'Point',
      coordinates: [-79.4, 8.95]
    },
    estimatedPrice: 100,
    status: 'requested',
    chatEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await db.collection('rides').insertOne(ride);
  return ride;
}