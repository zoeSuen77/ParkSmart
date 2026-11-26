'use strict';

// Shared seed logic: creates the three UAlbany commuter lots with 20 spots
// each and demo reservations matching the Milestone 3 demo state:
//   Dutch Quad    12/20 available (8 reserved)
//   State Quad     5/20 available (15 reserved)
//   Colonial Quad  0/20 available (20 reserved, Full)
// If lots already exist the seed is skipped so existing reservations are
// never destroyed. Use a fresh database for a full reset (development only).

const LOTS = [
  { name: 'Dutch Quad', capacity: 20, reserved: 8 },
  { name: 'State Quad', capacity: 20, reserved: 15 },
  { name: 'Colonial Quad', capacity: 20, reserved: 20 },
];

function spotLabel(i) {
  return `A-${String(i + 1).padStart(2, '0')}`;
}

async function seedIfEmpty(database, { log = console.log } = {}) {
  const existing = await database.collection('parking_lots').countDocuments();
  if (existing > 0) {
    log(`[seed] database already has ${existing} lot(s); skipping to protect existing data.`);
    return false;
  }

  let demoCounter = 0;
  for (const spec of LOTS) {
    const lotId = (
      await database.collection('parking_lots').insertOne({
        name: spec.name,
        capacity: spec.capacity,
        available_count: spec.capacity - spec.reserved,
      })
    ).insertedId;

    const spotDocs = [];
    for (let i = 0; i < spec.capacity; i++) {
      spotDocs.push({
        lot_id: lotId,
        label: spotLabel(i),
        status: i < spec.reserved ? 'Reserved' : 'Available',
      });
    }
    const spotInsert = await database.collection('parking_spots').insertMany(spotDocs);

    // Every Reserved spot gets a matching Active demo reservation so the
    // invariant "Reserved spot <=> Active reservation" always holds.
    const reservedSpotIds = Object.values(spotInsert.insertedIds).slice(0, spec.reserved);
    for (const spotId of reservedSpotIds) {
      demoCounter += 1;
      const plate = `DEMO${String(demoCounter).padStart(3, '0')}`.slice(0, 8);
      const studentId = (
        await database
          .collection('students')
          .findOneAndUpdate(
            { license_plate: plate },
            { $setOnInsert: { license_plate: plate, permit_type: 'Commuter', created_at: new Date() } },
            { upsert: true, returnDocument: 'after' }
          )
      )._id;
      await database.collection('reservations').insertOne({
        student_id: studentId,
        spot_id: spotId,
        lot_id: lotId,
        plate_snapshot: plate,
        status: 'Active',
        created_at: new Date(),
        released_at: null,
        owner_session_id: `seed-session-${demoCounter}`,
        request_key: `seed-request-${demoCounter}`,
      });
    }
    log(`[seed] ${spec.name}: ${spec.capacity} spots, ${spec.capacity - spec.reserved} available`);
  }
  log('[seed] done. Demo data only — not real Parking Services records.');
  return true;
}

module.exports = { seedIfEmpty, LOTS };
