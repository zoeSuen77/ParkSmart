'use strict';

const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');
const { seedIfEmpty } = require('./seed-data');

async function main() {
  await db.connect(config);
  console.log(`[db] connected to database "${config.mongoDb}" (transactions verified)`);

  // Development convenience: an empty database gets the demo lots so the app
  // is usable immediately. Existing data is never touched.
  await seedIfEmpty(db.getDb());

  // Allow `npm run dev -- --port 7100` style overrides.
  const portArgIdx = process.argv.indexOf('--port');
  const port =
    portArgIdx !== -1 && process.argv[portArgIdx + 1]
      ? Number(process.argv[portArgIdx + 1])
      : config.port;

  const app = createApp();
  app.listen(port, () => {
    console.log(`[server] ParkSmart listening on http://localhost:${port}`);
    console.log('[server] API at /api; built client served from client/dist when present');
    console.log('[server] for Vite hot-reload development use "npm run dev:hot" instead');
  });
}

main().catch((err) => {
  console.error('[startup] failed:', err.message);
  process.exit(1);
});
