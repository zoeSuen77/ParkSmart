'use strict';

// Database access layer. Connects to a transaction-capable MongoDB.
// When MONGODB_URI is not configured, an embedded single-node replica set
// (mongodb-memory-server) is started so transactions work out of the box.

const { MongoClient } = require('mongodb');

let memoryServer = null;
let client = null;
let db = null;

async function connect(config) {
  let uri = config.mongoUri;
  if (!uri) {
    // Lazy require so production installs without dev binaries still boot
    // when MONGODB_URI is provided.
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    uri = memoryServer.getUri(config.mongoDb);
    console.log('[db] MONGODB_URI not set; using embedded replica set');
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  db = client.db(config.mongoDb);

  await verifyTransactions();
  await ensureIndexes();
  return db;
}

async function verifyTransactions() {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('students').findOne({}, { session });
    });
  } catch (err) {
    throw new Error(
      'MongoDB does not support transactions. Use a replica set or Atlas. ' +
        `Original error: ${err.message}`
    );
  } finally {
    await session.endSession();
  }
}

async function ensureIndexes() {
  await Promise.all([
    db.collection('students').createIndex({ license_plate: 1 }, { unique: true }),
    db
      .collection('parking_spots')
      .createIndex({ lot_id: 1, label: 1 }, { unique: true }),
    db
      .collection('reservations')
      .createIndex(
        { spot_id: 1 },
        { unique: true, partialFilterExpression: { status: 'Active' }, name: 'active_spot_unique' }
      ),
    db
      .collection('reservations')
      .createIndex(
        { owner_session_id: 1 },
        { unique: true, partialFilterExpression: { status: 'Active' }, name: 'active_session_unique' }
      ),
    db
      .collection('reservations')
      .createIndex({ owner_session_id: 1, request_key: 1 }, { unique: true, name: 'request_key_unique' }),
  ]);
}

function getDb() {
  if (!db) throw new Error('Database not connected');
  return db;
}

function getClient() {
  if (!client) throw new Error('Database not connected');
  return client;
}

async function close() {
  if (client) await client.close();
  if (memoryServer) await memoryServer.stop();
  client = null;
  db = null;
  memoryServer = null;
}

module.exports = { connect, getDb, getClient, close };
