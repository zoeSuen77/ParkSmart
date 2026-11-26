'use strict';

// Integration tests for US-01..US-07, NFR-01/02/03.
// Runs the real Express app + real MongoDB transactions (embedded replica set).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, makeClient, registerPlate, firstAvailableSpot } = require('./helpers');

let ctx;
let base;

before(async () => {
  ctx = await startTestServer();
  base = ctx.base;
});

after(async () => {
  await ctx.close();
});

async function invariantCheck(t) {
  // available_count must equal the number of Available spots per lot, and
  // every Reserved spot must have exactly one Active reservation.
  const lots = await ctx.db.collection('parking_lots').find({}).toArray();
  for (const lot of lots) {
    const available = await ctx.db
      .collection('parking_spots')
      .countDocuments({ lot_id: lot._id, status: 'Available' });
    assert.equal(lot.available_count, available, `${lot.name}: count mismatch`);
    const reserved = await ctx.db
      .collection('parking_spots')
      .find({ lot_id: lot._id, status: 'Reserved' })
      .toArray();
    for (const spot of reserved) {
      const actives = await ctx.db
        .collection('reservations')
        .countDocuments({ spot_id: spot._id, status: 'Active' });
      assert.equal(actives, 1, `${lot.name} ${spot.label}: expected 1 active reservation`);
    }
  }
}

test('US-01: plate validation, save, session recovery, and lock during reservation', async (t) => {
  const c = makeClient(base);

  for (const bad of ['', 'A', 'ABC 123', 'ABC-123', 'ABCDEFGHI', '!!']) {
    const res = await registerPlate(c, bad);
    assert.equal(res.status, 400, `plate "${bad}" should be rejected`);
    assert.equal(res.body.error.code, 'INVALID_PLATE');
  }

  const ok = await registerPlate(c, '  abc123 ');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.plate, 'ABC123', 'plate is trimmed and uppercased');

  // Same session reads the plate back (refresh recovery).
  const session = await c('/api/session');
  assert.equal(session.body.plate, 'ABC123');

  // Plate is locked while a reservation is active.
  const { spot } = await firstAvailableSpot(c, 'Dutch Quad');
  const created = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'us01-key' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(created.status, 201);
  const locked = await registerPlate(c, 'XYZ999');
  assert.equal(locked.status, 409);
  assert.equal(locked.body.error.code, 'PLATE_LOCKED');

  // Clean up: release so later tests start fresh.
  const rel = await c(`/api/reservations/${created.body.reservation.id}/release`, { method: 'POST' });
  assert.equal(rel.status, 200);
  await invariantCheck(t);
});

test('US-02/US-03: lot list shows capacity, counts and status labels', async () => {
  const c = makeClient(base);
  const res = await c('/api/lots');
  assert.equal(res.status, 200);
  assert.equal(res.body.lots.length, 3);
  const byName = Object.fromEntries(res.body.lots.map((l) => [l.name, l]));
  assert.deepEqual(
    { cap: byName['Dutch Quad'].capacity, avail: byName['Dutch Quad'].availableCount, st: byName['Dutch Quad'].status },
    { cap: 20, avail: 12, st: 'Available' }
  );
  assert.deepEqual(
    { avail: byName['State Quad'].availableCount, st: byName['State Quad'].status },
    { avail: 5, st: 'Limited' }
  );
  assert.deepEqual(
    { avail: byName['Colonial Quad'].availableCount, st: byName['Colonial Quad'].status },
    { avail: 0, st: 'Full' }
  );
});

test('US-04: spot list shows every spot with a text status', async () => {
  const c = makeClient(base);
  const { lot } = await firstAvailableSpot(c, 'Dutch Quad');
  const res = await c(`/api/lots/${lot.id}/spots`);
  assert.equal(res.status, 200);
  assert.equal(res.body.spots.length, 20);
  for (const s of res.body.spots) {
    assert.ok(['Available', 'Reserved'].includes(s.status));
    assert.ok(/^A-\d{2}$/.test(s.label));
  }
  const missing = await c('/api/lots/000000000000000000000000/spots');
  assert.equal(missing.status, 404);
});

test('US-05 + NFR-02: two sessions racing for the same spot — exactly one wins, count drops by one', async (t) => {
  const a = makeClient(base);
  const b = makeClient(base);
  await registerPlate(a, 'RACE001');
  await registerPlate(b, 'RACE002');

  const { lot, spot } = await firstAvailableSpot(a, 'Dutch Quad');
  const before = (await a('/api/lots')).body.lots.find((l) => l.id === lot.id).availableCount;

  const [ra, rb] = await Promise.all([
    a('/api/reservations', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'race-a' },
      body: { spotId: spot.id, safelyParked: true },
    }),
    b('/api/reservations', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'race-b' },
      body: { spotId: spot.id, safelyParked: true },
    }),
  ]);

  const statuses = [ra.status, rb.status].sort();
  assert.deepEqual(statuses, [201, 409], 'exactly one reservation succeeds');
  const loser = ra.status === 409 ? ra : rb;
  assert.equal(loser.body.error.code, 'SPOT_TAKEN');

  const afterLots = (await a('/api/lots')).body.lots.find((l) => l.id === lot.id).availableCount;
  assert.equal(afterLots, before - 1, 'availability decreased by exactly one');

  const activeForSpot = await ctx.db
    .collection('reservations')
    .countDocuments({ spot_id: new (require('mongodb').ObjectId)(spot.id), status: 'Active' });
  assert.equal(activeForSpot, 1);

  // Winner releases; availability goes back up by exactly one.
  const winner = ra.status === 201 ? ra : rb;
  const winnerClient = ra.status === 201 ? a : b;
  const rel = await winnerClient(`/api/reservations/${winner.body.reservation.id}/release`, { method: 'POST' });
  assert.equal(rel.status, 200);
  const final = (await a('/api/lots')).body.lots.find((l) => l.id === lot.id).availableCount;
  assert.equal(final, before, 'release restored availability by exactly one');
  await invariantCheck(t);
});

test('US-05: safety confirmation, cancel writes nothing, second active reservation rejected', async (t) => {
  const c = makeClient(base);
  await registerPlate(c, 'SAFE001');
  const { lot, spot } = await firstAvailableSpot(c, 'Dutch Quad');
  const before = (await c('/api/lots')).body.lots.find((l) => l.id === lot.id).availableCount;

  // Without safety confirmation -> 400, nothing written.
  const noConfirm = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'safe-0' },
    body: { spotId: spot.id, safelyParked: false },
  });
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.body.error.code, 'SAFETY_NOT_CONFIRMED');
  let lots = (await c('/api/lots')).body.lots.find((l) => l.id === lot.id);
  assert.equal(lots.availableCount, before, 'cancelled/unconfirmed attempt changes nothing');

  // Confirmed -> 201. Retry of the same request key replays the same record.
  const created = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'safe-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(created.status, 201);

  // A second, different spot with a new key -> 409 (one active per session).
  const { spot: spot2 } = await firstAvailableSpot(c, 'Dutch Quad');
  const second = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'safe-2' },
    body: { spotId: spot2.id, safelyParked: true },
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'ACTIVE_RESERVATION_EXISTS');

  const rel = await c(`/api/reservations/${created.body.reservation.id}/release`, { method: 'POST' });
  assert.equal(rel.status, 200);
  await invariantCheck(t);
});

test('US-05: idempotent replay — same key same spot returns original; same key different spot conflicts; replay after release creates nothing new', async (t) => {
  const c = makeClient(base);
  await registerPlate(c, 'IDEM001');
  const { lot, spot } = await firstAvailableSpot(c, 'Dutch Quad');
  const before = (await c('/api/lots')).body.lots.find((l) => l.id === lot.id).availableCount;

  const created = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'idem-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(created.status, 201);
  const rid = created.body.reservation.id;

  // Network retry with the same key: 200 replay, same reservation, no count change.
  const replay = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'idem-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.reservation.id, rid);
  assert.equal(replay.body.replayed, true);
  let lots = (await c('/api/lots')).body.lots.find((l) => l.id === lot.id);
  assert.equal(lots.availableCount, before - 1);

  // Same key reused for a different spot -> 409.
  const { spot: other } = await firstAvailableSpot(c, 'Dutch Quad');
  const conflict = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'idem-1' },
    body: { spotId: other.id, safelyParked: true },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'REQUEST_KEY_CONFLICT');

  // Release, then replay the original create request: the late retry must
  // NOT create a new reservation — it returns the Released record.
  const rel = await c(`/api/reservations/${rid}/release`, { method: 'POST' });
  assert.equal(rel.status, 200);
  const lateRetry = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'idem-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(lateRetry.status, 200);
  assert.equal(lateRetry.body.reservation.id, rid);
  assert.equal(lateRetry.body.reservation.status, 'Released');
  lots = (await c('/api/lots')).body.lots.find((l) => l.id === lot.id);
  assert.equal(lots.availableCount, before, 'late replay changed no counts');

  const current = await c('/api/reservations/current');
  assert.equal(current.body.reservation, null, 'no phantom active reservation');
  await invariantCheck(t);
});

test('US-06: refresh recovery — same session reads its active reservation back', async () => {
  const c = makeClient(base);
  await registerPlate(c, 'REFR001');
  const { spot } = await firstAvailableSpot(c, 'State Quad');
  const created = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'refr-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(created.status, 201);

  // Simulated refresh: same cookie, fresh GET from the server.
  const current = await c('/api/reservations/current');
  assert.equal(current.status, 200);
  assert.equal(current.body.reservation.id, created.body.reservation.id);
  assert.equal(current.body.reservation.status, 'Active');
  assert.equal(current.body.reservation.plate, 'REFR001');
  assert.equal(current.body.reservation.lot.name, 'State Quad');

  // Read does not mutate state.
  const again = await c('/api/reservations/current');
  assert.deepEqual(again.body.reservation, current.body.reservation);

  await c(`/api/reservations/${created.body.reservation.id}/release`, { method: 'POST' });
});

test('US-07 + NFR-03: only the owning session can release; duplicate and stale releases never double-count', async (t) => {
  const owner = makeClient(base);
  const stranger = makeClient(base);
  await registerPlate(owner, 'OWN0001');
  await registerPlate(stranger, 'OWN0002');

  const { lot, spot } = await firstAvailableSpot(owner, 'Dutch Quad');
  const before = (await owner('/api/lots')).body.lots.find((l) => l.id === lot.id).availableCount;

  const created = await owner('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'own-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(created.status, 201);
  const rid = created.body.reservation.id;

  // Stranger knows the plate AND the reservation id: still rejected (404),
  // and state is unchanged.
  const forbidden = await stranger(`/api/reservations/${rid}/release`, { method: 'POST' });
  assert.equal(forbidden.status, 404);
  let current = await owner('/api/reservations/current');
  assert.equal(current.body.reservation.status, 'Active');

  // Owner releases: +1 availability.
  const rel1 = await owner(`/api/reservations/${rid}/release`, { method: 'POST' });
  assert.equal(rel1.status, 200);
  assert.equal(rel1.body.reservation.status, 'Released');
  let lots = (await owner('/api/lots')).body.lots.find((l) => l.id === lot.id);
  assert.equal(lots.availableCount, before, 'release added exactly one');

  // Duplicate release: 200, idempotent, no extra increment.
  const rel2 = await owner(`/api/reservations/${rid}/release`, { method: 'POST' });
  assert.equal(rel2.status, 200);
  assert.equal(rel2.body.alreadyReleased, true);
  lots = (await owner('/api/lots')).body.lots.find((l) => l.id === lot.id);
  assert.equal(lots.availableCount, before, 'duplicate release did not add again');

  // Someone else reserves the same spot afterwards…
  const third = makeClient(base);
  await registerPlate(third, 'OWN0003');
  const created2 = await third('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'own-3' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(created2.status, 201);

  // …a stale release request for the OLD reservation must not free the new one.
  const stale = await owner(`/api/reservations/${rid}/release`, { method: 'POST' });
  assert.equal(stale.status, 200);
  assert.equal(stale.body.reservation.status, 'Released');
  const thirdCurrent = await third('/api/reservations/current');
  assert.equal(thirdCurrent.body.reservation.status, 'Active', 'new reservation untouched');
  lots = (await owner('/api/lots')).body.lots.find((l) => l.id === lot.id);
  assert.equal(lots.availableCount, before - 1, 'spot still reserved by the new owner');

  await third(`/api/reservations/${created2.body.reservation.id}/release`, { method: 'POST' });
  await invariantCheck(t);
});

test('US-05: reserving without a plate is rejected (401)', async () => {
  const c = makeClient(base);
  const { spot } = await firstAvailableSpot(c, 'Dutch Quad');
  const res = await c('/api/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'noplate-1' },
    body: { spotId: spot.id, safelyParked: true },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'PLATE_REQUIRED');
});

test('NFR-01: spot list for a 20-spot lot responds within 2s — 5 consecutive runs', async () => {
  const c = makeClient(base);
  const { lot } = await firstAvailableSpot(c, 'Dutch Quad');
  const timings = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const res = await c(`/api/lots/${lot.id}/spots`);
    const ms = performance.now() - start;
    assert.equal(res.status, 200);
    assert.equal(res.body.spots.length, 20);
    timings.push(Math.round(ms));
  }
  console.log(`[NFR-01] spot list timings (ms): ${timings.join(', ')}`);
  for (const ms of timings) assert.ok(ms < 2000, `${ms}ms exceeded 2s`);
});
