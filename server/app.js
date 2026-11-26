'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { ObjectId } = require('mongodb');
const { getDb, getClient } = require('./db');
const { sessionMiddleware } = require('./session');

// ---------- helpers ----------

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function lotStatus(availableCount, capacity) {
  if (availableCount === null || availableCount === undefined) return 'Unknown';
  if (availableCount <= 0) return 'Full';
  if (capacity > 0 && availableCount / capacity > 0.25) return 'Available';
  return 'Limited';
}

function lotDto(lot) {
  return {
    id: String(lot._id),
    name: lot.name,
    capacity: lot.capacity,
    availableCount: lot.available_count ?? null,
    status: lotStatus(lot.available_count, lot.capacity),
  };
}

async function reservationDto(db, reservation) {
  const [lot, spot] = await Promise.all([
    db.collection('parking_lots').findOne({ _id: reservation.lot_id }),
    db.collection('parking_spots').findOne({ _id: reservation.spot_id }),
  ]);
  return {
    id: String(reservation._id),
    status: reservation.status,
    plate: reservation.plate_snapshot,
    createdAt: reservation.created_at,
    releasedAt: reservation.released_at || null,
    lot: lot ? { id: String(lot._id), name: lot.name } : null,
    spot: spot ? { id: String(spot._id), label: spot.label } : null,
  };
}

function normalizePlate(raw) {
  if (typeof raw !== 'string') return null;
  const plate = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(plate)) return null;
  return plate;
}

// ---------- reservation service ----------

async function createReservation({ sessionId, spotId, requestKey }) {
  const db = getDb();
  const client = getClient();

  // Idempotent replay: a retry with the same request key returns the
  // original reservation (even if it has since been released).
  const existing = await db.collection('reservations').findOne({
    owner_session_id: sessionId,
    request_key: requestKey,
  });
  if (existing) {
    if (!existing.spot_id.equals(spotId)) {
      throw new ApiError(
        409,
        'REQUEST_KEY_CONFLICT',
        'This request key was already used for a different spot.'
      );
    }
    return { dto: await reservationDto(db, existing), replayed: true };
  }

  const session = client.startSession();
  let created = null;
  try {
    await session.withTransaction(async () => {
      // Re-verify the session inside the transaction: the plate must be
      // registered and must not change while a reservation is active.
      const sessDoc = await db
        .collection('sessions')
        .findOne({ _id: sessionId }, { session });
      if (!sessDoc || !sessDoc.plate || !sessDoc.student_id) {
        throw new ApiError(401, 'PLATE_REQUIRED', 'Register a license plate before reserving.');
      }

      // Conditional claim: only an Available spot can become Reserved.
      const spotUpdate = await db.collection('parking_spots').findOneAndUpdate(
        { _id: spotId, status: 'Available' },
        { $set: { status: 'Reserved' } },
        { session, returnDocument: 'after' }
      );
      if (!spotUpdate) {
        const spot = await db.collection('parking_spots').findOne({ _id: spotId }, { session });
        if (!spot) throw new ApiError(404, 'NOT_FOUND', 'Parking spot not found.');
        throw new ApiError(
          409,
          'SPOT_TAKEN',
          'This spot was just reserved by someone else. Please pick another spot.'
        );
      }

      // Keep the lot counter consistent with the spot flip.
      const lotUpdate = await db
        .collection('parking_lots')
        .findOneAndUpdate(
          { _id: spotUpdate.lot_id, available_count: { $gte: 1 } },
          { $inc: { available_count: -1 } },
          { session, returnDocument: 'after' }
        );
      if (!lotUpdate) {
        throw new ApiError(500, 'INTERNAL', 'Availability changed; please retry.');
      }

      const doc = {
        student_id: sessDoc.student_id,
        spot_id: spotId,
        lot_id: spotUpdate.lot_id,
        plate_snapshot: sessDoc.plate,
        status: 'Active',
        created_at: new Date(),
        released_at: null,
        owner_session_id: sessionId,
        request_key: requestKey,
      };
      const insert = await db.collection('reservations').insertOne(doc, { session });
      created = { ...doc, _id: insert.insertedId };
    });
  } catch (err) {
    // Unique-index races map to deterministic outcomes.
    if (err && err.code === 11000) {
      if (err.keyPattern && err.keyPattern.request_key !== undefined) {
        const replay = await db
          .collection('reservations')
          .findOne({ owner_session_id: sessionId, request_key: requestKey });
        if (replay) {
          if (!replay.spot_id.equals(spotId)) {
            throw new ApiError(409, 'REQUEST_KEY_CONFLICT', 'This request key was already used for a different spot.');
          }
          return { dto: await reservationDto(db, replay), replayed: true };
        }
      }
      if (err.keyPattern && err.keyPattern.spot_id !== undefined) {
        throw new ApiError(409, 'SPOT_TAKEN', 'This spot was just reserved by someone else. Please pick another spot.');
      }
      throw new ApiError(409, 'ACTIVE_RESERVATION_EXISTS', 'This session already has an active reservation.');
    }
    throw err;
  } finally {
    await session.endSession();
  }

  return { dto: await reservationDto(db, created), replayed: false };
}

async function releaseReservation({ sessionId, reservationId }) {
  const db = getDb();
  const client = getClient();

  const reservation = await db.collection('reservations').findOne({ _id: reservationId });
  // Non-owners get the same 404 as unknown IDs: no existence leak.
  if (!reservation || reservation.owner_session_id !== sessionId) {
    throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');
  }
  // Already released (duplicate release or stale request replay): return the
  // released record without touching spot or lot counts.
  if (reservation.status === 'Released') {
    return { dto: await reservationDto(db, reservation), alreadyReleased: true };
  }

  const session = client.startSession();
  let released = null;
  let performedRelease = false;
  try {
    await session.withTransaction(async () => {
      // Conditional release: exactly one writer can flip Active -> Released
      // for this owner + reservation.
      const update = await db.collection('reservations').findOneAndUpdate(
        { _id: reservationId, owner_session_id: sessionId, status: 'Active' },
        { $set: { status: 'Released', released_at: new Date() } },
        { session, returnDocument: 'after' }
      );
      if (!update) {
        const current = await db
          .collection('reservations')
          .findOne({ _id: reservationId }, { session });
        if (current && current.status === 'Released' && current.owner_session_id === sessionId) {
          released = current;
          return; // a concurrent duplicate release already committed
        }
        throw new ApiError(409, 'RELEASE_CONFLICT', 'Reservation state changed; please retry.');
      }
      performedRelease = true;

      const spotUpdate = await db
        .collection('parking_spots')
        .findOneAndUpdate(
          { _id: update.spot_id, status: 'Reserved' },
          { $set: { status: 'Available' } },
          { session, returnDocument: 'after' }
        );
      if (!spotUpdate) {
        throw new ApiError(500, 'INTERNAL', 'Spot state changed; release aborted.');
      }

      await db
        .collection('parking_lots')
        .updateOne({ _id: update.lot_id }, { $inc: { available_count: 1 } }, { session });

      released = update;
    });
  } finally {
    await session.endSession();
  }

  return { dto: await reservationDto(db, released), alreadyReleased: !performedRelease };
}

// ---------- express app ----------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(sessionMiddleware);

  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // US-01: plate registration
  app.put(
    '/api/session/plate',
    wrap(async (req, res) => {
      const plate = normalizePlate(req.body?.plate);
      if (!plate) {
        throw new ApiError(
          400,
          'INVALID_PLATE',
          'Plates must be 2-8 letters or digits (example: ABC123). Spaces and symbols are not allowed.'
        );
      }
      const db = getDb();
      const active = await db.collection('reservations').findOne({
        owner_session_id: req.sessionId,
        status: 'Active',
      });
      if (active) {
        throw new ApiError(
          409,
          'PLATE_LOCKED',
          'You have an active reservation. Release it before changing your plate.'
        );
      }
      const student = await db
        .collection('students')
        .findOneAndUpdate(
          { license_plate: plate },
          { $setOnInsert: { license_plate: plate, permit_type: 'Commuter', created_at: new Date() } },
          { upsert: true, returnDocument: 'after' }
        );
      await db.collection('sessions').updateOne(
        { _id: req.sessionId },
        { $set: { plate, student_id: student._id, updated_at: new Date() } }
      );
      req.sessionDoc.plate = plate;
      req.sessionDoc.student_id = student._id;
      res.json({ plate });
    })
  );

  app.get('/api/session', (req, res) => {
    res.json({ plate: req.sessionDoc.plate || null });
  });

  // US-02 / US-03: lots overview
  app.get(
    '/api/lots',
    wrap(async (req, res) => {
      const lots = await getDb().collection('parking_lots').find({}).sort({ name: 1 }).toArray();
      res.json({ lots: lots.map(lotDto) });
    })
  );

  // US-04: spots of one lot
  app.get(
    '/api/lots/:lotId/spots',
    wrap(async (req, res) => {
      if (!ObjectId.isValid(req.params.lotId)) {
        throw new ApiError(404, 'NOT_FOUND', 'Parking lot not found.');
      }
      const db = getDb();
      const lot = await db
        .collection('parking_lots')
        .findOne({ _id: new ObjectId(req.params.lotId) });
      if (!lot) throw new ApiError(404, 'NOT_FOUND', 'Parking lot not found.');
      const spots = await db
        .collection('parking_spots')
        .find({ lot_id: lot._id })
        .sort({ label: 1 })
        .toArray();
      res.json({
        lot: lotDto(lot),
        spots: spots.map((s) => ({ id: String(s._id), label: s.label, status: s.status })),
      });
    })
  );

  // US-05: create reservation
  app.post(
    '/api/reservations',
    wrap(async (req, res) => {
      if (!req.sessionDoc.plate) {
        throw new ApiError(401, 'PLATE_REQUIRED', 'Register a license plate before reserving.');
      }
      const { spotId, safelyParked } = req.body || {};
      if (!spotId || !ObjectId.isValid(spotId)) {
        throw new ApiError(400, 'INVALID_INPUT', 'A valid spotId is required.');
      }
      if (safelyParked !== true) {
        throw new ApiError(
          400,
          'SAFETY_NOT_CONFIRMED',
          'Please confirm you have safely parked before reserving.'
        );
      }
      const requestKey = req.get('Idempotency-Key');
      if (!requestKey || requestKey.length > 128) {
        throw new ApiError(400, 'INVALID_INPUT', 'A valid Idempotency-Key header is required.');
      }
      const { dto, replayed } = await createReservation({
        sessionId: req.sessionId,
        spotId: new ObjectId(spotId),
        requestKey,
      });
      res.status(replayed ? 200 : 201).json({ reservation: dto, replayed });
    })
  );

  // US-06: current reservation
  app.get(
    '/api/reservations/current',
    wrap(async (req, res) => {
      const db = getDb();
      const active = await db.collection('reservations').findOne({
        owner_session_id: req.sessionId,
        status: 'Active',
      });
      res.json({ reservation: active ? await reservationDto(db, active) : null });
    })
  );

  // US-07: release reservation
  app.post(
    '/api/reservations/:id/release',
    wrap(async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');
      }
      const { dto, alreadyReleased } = await releaseReservation({
        sessionId: req.sessionId,
        reservationId: new ObjectId(req.params.id),
      });
      res.json({ reservation: dto, alreadyReleased });
    })
  );

  // Production: serve the built client from the same origin.
  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    res.sendFile(path.join(dist, 'index.html'), (err) => err && next());
  });

  // Error contract: stable code + displayable message.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    }
    console.error('[api] unexpected error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
  });

  return app;
}

module.exports = { createApp, ApiError };
