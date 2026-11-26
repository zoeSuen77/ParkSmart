'use strict';

// Test helpers: boot the real Express app against a throwaway embedded
// replica set (transactions supported), plus a cookie-aware HTTP client.

const db = require('../db');
const { createApp } = require('../app');
const { seedIfEmpty } = require('../seed-data');

async function startTestServer() {
  await db.connect({ mongoUri: null, mongoDb: `parksmart-test-${Date.now()}` });
  await seedIfEmpty(db.getDb(), { log: () => {} });
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    db: db.getDb(),
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}

// Minimal session client: keeps the session cookie like a browser would.
function makeClient(base) {
  let cookie = null;
  return async function call(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* empty */
    }
    return { status: res.status, body: json };
  };
}

async function registerPlate(client, plate) {
  return client('/api/session/plate', { method: 'PUT', body: { plate } });
}

async function firstAvailableSpot(client, lotName) {
  const { body } = await client('/api/lots');
  const lot = body.lots.find((l) => l.name === lotName);
  const spotsRes = await client(`/api/lots/${lot.id}/spots`);
  const spot = spotsRes.body.spots.find((s) => s.status === 'Available');
  return { lot, spot };
}

module.exports = { startTestServer, makeClient, registerPlate, firstAvailableSpot };
