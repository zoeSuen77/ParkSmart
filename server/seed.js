'use strict';

// CLI seed: `npm run seed`. Seeds the configured database if it is empty.
// Note: the embedded in-memory database is auto-seeded by `npm run dev:server`
// / `npm start` on startup; this command is meant for a persistent
// MONGODB_URI database.

const config = require('./config');
const db = require('./db');
const { seedIfEmpty } = require('./seed-data');

async function main() {
  if (!config.mongoUri) {
    console.log('[seed] MONGODB_URI is not set.');
    console.log('[seed] The embedded development database seeds itself on server start;');
    console.log('[seed] set MONGODB_URI in .env to seed a persistent database.');
    return;
  }
  await db.connect(config);
  await seedIfEmpty(db.getDb());
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
