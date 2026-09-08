import mongoose, { Types } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function isPortOpen(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let called = false;
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      called = true;
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      if (!called) {
        called = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.on('error', () => {
      if (!called) {
        called = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.connect(port, host);
  });
}

async function resolveMongoUri(): Promise<string> {
  const uriFile = path.resolve(process.cwd(), '.mongo-uri');
  if (fs.existsSync(uriFile)) {
    const saved = fs.readFileSync(uriFile, 'utf8').trim();
    if (saved) return saved;
  }

  const envUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/equipment-ledger?replicaSet=rs0';
  if (!envUri.includes('mongodb+srv://')) {
    try {
      const parsed = new URL(envUri.replace('mongodb://', 'http://'));
      const host = parsed.hostname || 'localhost';
      const port = parseInt(parsed.port, 10) || 27017;
      const reachable = await isPortOpen(host, port, 1000);
      if (reachable) return envUri;
    } catch {}
  } else {
    return envUri;
  }

  console.log('Local MongoDB not running. Initializing in-memory replica set for seed...');
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
  });
  const uri = replSet.getUri('equipment-ledger');
  fs.writeFileSync(uriFile, uri, 'utf8');
  return uri;
}

const KEEPER_NAMES = ['Alex Morgan', 'Sam Taylor', 'Jordan Lee'];

async function seed() {
  const MONGODB_URI = await resolveMongoUri();
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed.');
  }

  console.log('Clearing existing collections for clean deterministic seed...');
  await Promise.all([
    db.collection('assets').deleteMany({}),
    db.collection('workers').deleteMany({}),
    db.collection('reservations').deleteMany({}),
    db.collection('movements').deleteMany({}),
  ]);

  // Establish deterministic base date: today is reference now
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // 1. Seed Workers (~12 workers)
  console.log('Seeding workers...');
  const workersData = [
    {
      _id: new Types.ObjectId(),
      name: 'Marcus Vance',
      certifications: [
        {
          type: 'Working at Heights',
          expiryDate: new Date(now.getTime() - 2 * dayMs), // EXPIRED 2 days ago
        },
        {
          type: 'Confined Spaces',
          expiryDate: new Date(now.getTime() + 180 * dayMs), // Valid
        },
      ],
    },
    {
      _id: new Types.ObjectId(),
      name: 'Elena Rostova',
      certifications: [
        {
          type: 'Working at Heights',
          expiryDate: new Date(now.getTime() + 12 * dayMs), // EXPIRING in 12 days (within 30-day window)
        },
      ],
    },
    {
      _id: new Types.ObjectId(),
      name: 'David Kim',
      certifications: [
        {
          type: 'Confined Spaces',
          expiryDate: new Date(now.getTime() + 90 * dayMs), // Valid
        },
        {
          type: 'Working at Heights',
          expiryDate: new Date(now.getTime() + 90 * dayMs), // Valid
        },
      ],
    },
    {
      _id: new Types.ObjectId(),
      name: 'Sarah Connor',
      certifications: [
        {
          type: 'Working at Heights',
          expiryDate: new Date(now.getTime() + 120 * dayMs), // Valid
        },
      ],
    },
    {
      _id: new Types.ObjectId(),
      name: 'Liam Chen',
      certifications: [
        {
          type: 'Confined Spaces',
          expiryDate: new Date(now.getTime() + 60 * dayMs), // Valid
        },
      ],
    },
    { _id: new Types.ObjectId(), name: 'Carlos Mendez', certifications: [] },
    { _id: new Types.ObjectId(), name: 'Fatima Al-Mansoor', certifications: [] },
    { _id: new Types.ObjectId(), name: 'James Thornton', certifications: [] },
    {
      _id: new Types.ObjectId(),
      name: 'Aisha Diallo',
      certifications: [
        {
          type: 'Working at Heights',
          expiryDate: new Date(now.getTime() + 240 * dayMs),
        },
      ],
    },
    { _id: new Types.ObjectId(), name: 'Priya Sharma', certifications: [] },
    { _id: new Types.ObjectId(), name: 'Tom Kowalski', certifications: [] },
    { _id: new Types.ObjectId(), name: 'Rachel Green', certifications: [] },
  ];

  await db.collection('workers').insertMany(workersData);
  console.log(`Seeded ${workersData.length} workers.`);

  // 2. Seed Assets (~60 assets across 7 kinds)
  console.log('Seeding assets...');
  const assetKinds = [
    { kind: 'harness', prefix: 'HARN', requiresCert: 'Working at Heights', count: 10 },
    { kind: 'gas-detector', prefix: 'GASD', requiresCert: 'Confined Spaces', count: 8 },
    { kind: 'tripod', prefix: 'TRIP', requiresCert: 'Confined Spaces', count: 4 },
    { kind: 'drill', prefix: 'DRIL', requiresCert: null, count: 12 },
    { kind: 'ladder', prefix: 'LADD', requiresCert: null, count: 8 },
    { kind: 'generator', prefix: 'GENR', requiresCert: null, count: 6 },
    { kind: 'radio', prefix: 'RADI', requiresCert: null, count: 8 },
    { kind: 'grinder', prefix: 'GRND', requiresCert: null, count: 6 },
  ];

  const assets: any[] = [];
  let assetIdx = 1;

  for (const group of assetKinds) {
    for (let i = 1; i <= group.count; i++) {
      const code = `${group.prefix}-${String(i).padStart(3, '0')}`;
      assets.push({
        _id: new Types.ObjectId(),
        code,
        kind: group.kind,
        requiresCertification: group.requiresCert,
        currentHolder: null, // will be updated below for currently issued assets
        isOutOfService: false,
        createdAt: new Date(now.getTime() - 40 * dayMs),
      });
      assetIdx++;
    }
  }

  // 3. Mark at least 2 assets as OUT OF SERVICE initially
  // e.g. DRIL-004 and HARN-008
  const oosAsset1 = assets.find((a) => a.code === 'DRIL-004')!;
  oosAsset1.isOutOfService = true;

  const oosAsset2 = assets.find((a) => a.code === 'HARN-008')!;
  oosAsset2.isOutOfService = true;

  console.log(`Generated ${assets.length} assets.`);

  // 4. Movements & History generation over the last 30 days
  console.log('Seeding 30 days of movements and reservations...');
  const movements: any[] = [];
  const reservations: any[] = [];

  // Out of service movement for DRIL-004
  movements.push({
    _id: new Types.ObjectId(),
    type: 'OUT_OF_SERVICE',
    assetId: oosAsset1._id,
    workerId: null,
    reservationId: null,
    occurredAt: new Date(now.getTime() - 15 * dayMs),
    recordedAt: new Date(now.getTime() - 15 * dayMs),
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-oos-dril-004',
    meta: { reason: 'Motor burnt out during inspection' },
  });

  // Out of service movement for HARN-008 (returned damaged by worker 10 days ago)
  movements.push({
    _id: new Types.ObjectId(),
    type: 'RETURN',
    assetId: oosAsset2._id,
    workerId: workersData[3]._id,
    reservationId: null,
    occurredAt: new Date(now.getTime() - 10 * dayMs),
    recordedAt: new Date(now.getTime() - 10 * dayMs),
    keeperName: 'Sam Taylor',
    actor: 'KEEPER',
    idempotencyKey: 'seed-ret-harn-008',
    condition: 'DAMAGED',
  });
  movements.push({
    _id: new Types.ObjectId(),
    type: 'OUT_OF_SERVICE',
    assetId: oosAsset2._id,
    workerId: workersData[3]._id,
    reservationId: null,
    occurredAt: new Date(now.getTime() - 10 * dayMs),
    recordedAt: new Date(now.getTime() - 10 * dayMs),
    keeperName: 'Sam Taylor',
    actor: 'KEEPER',
    idempotencyKey: 'seed-oos-harn-008',
    meta: { reason: 'Webbing frayed' },
  });

  // Regular historical issues and returns across past 25 days
  let moveIdx = 100;
  for (let d = 25; d >= 3; d -= 2) {
    const asset = assets[moveIdx % assets.length];
    if (asset.isOutOfService) continue;

    const worker = workersData[moveIdx % workersData.length];
    // Check cert if required
    if (
      asset.requiresCertification &&
      !worker.certifications.some(
        (c) => c.type === asset.requiresCertification && c.expiryDate > now,
      )
    ) {
      continue;
    }

    const issueTime = new Date(now.getTime() - d * dayMs + 8 * 3600 * 1000);
    const returnTime = new Date(now.getTime() - d * dayMs + 16 * 3600 * 1000);

    const issueId = new Types.ObjectId();
    movements.push({
      _id: issueId,
      type: 'ISSUE',
      assetId: asset._id,
      workerId: worker._id,
      reservationId: null,
      occurredAt: issueTime,
      recordedAt: issueTime,
      keeperName: KEEPER_NAMES[moveIdx % KEEPER_NAMES.length],
      actor: 'KEEPER',
      idempotencyKey: `seed-issue-hist-${moveIdx}`,
    });

    movements.push({
      _id: new Types.ObjectId(),
      type: 'RETURN',
      assetId: asset._id,
      workerId: worker._id,
      reservationId: null,
      occurredAt: returnTime,
      recordedAt: returnTime,
      keeperName: KEEPER_NAMES[(moveIdx + 1) % KEEPER_NAMES.length],
      actor: 'KEEPER',
      idempotencyKey: `seed-return-hist-${moveIdx}`,
      condition: 'OK',
    });

    moveIdx++;
  }

  // 5. Late-logged entry requirement (§9):
  // "at least 1 late-logged entry (recordedAt meaningfully after occurredAt)"
  // e.g. LADD-002 returned yesterday at 09:00, but logged at 11:40
  const lateAsset = assets.find((a) => a.code === 'LADD-002')!;
  const lateOccurredAt = new Date(now.getTime() - 1 * dayMs + 9 * 3600 * 1000); // 09:00
  const lateRecordedAt = new Date(
    now.getTime() - 1 * dayMs + 11 * 3600 * 1000 + 40 * 60 * 1000,
  ); // 11:40
  movements.push({
    _id: new Types.ObjectId(),
    type: 'RETURN',
    assetId: lateAsset._id,
    workerId: workersData[5]._id,
    reservationId: null,
    occurredAt: lateOccurredAt,
    recordedAt: lateRecordedAt,
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-late-logged-return',
    condition: 'OK',
  });

  // 6. Correction requirement (§9):
  // "at least 1 correction (a CORRECTION Movement referencing an earlier one)"
  // Let's create an issue for DRIL-001 5 days ago that had occurredAt logged as 10:30,
  // then corrected to 08:30 by keeper
  const drill001 = assets.find((a) => a.code === 'DRIL-001')!;
  const origMovementId = new Types.ObjectId();
  const origOccurredAt = new Date(now.getTime() - 5 * dayMs + 10.5 * 3600 * 1000);
  const origRecordedAt = new Date(now.getTime() - 5 * dayMs + 10.5 * 3600 * 1000);
  const correctedOccurredAt = new Date(
    now.getTime() - 5 * dayMs + 8.5 * 3600 * 1000,
  );

  movements.push({
    _id: origMovementId,
    type: 'ISSUE',
    assetId: drill001._id,
    workerId: workersData[2]._id,
    reservationId: null,
    occurredAt: origOccurredAt,
    recordedAt: origRecordedAt,
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-orig-issue-dril001',
  });

  movements.push({
    _id: new Types.ObjectId(),
    type: 'CORRECTION',
    assetId: drill001._id,
    workerId: workersData[2]._id,
    reservationId: null,
    occurredAt: origOccurredAt, // retains original timestamp
    recordedAt: new Date(now.getTime() - 5 * dayMs + 12 * 3600 * 1000), // corrected 1.5 hrs later
    keeperName: 'Sam Taylor',
    actor: 'KEEPER',
    idempotencyKey: 'seed-correction-dril001',
    correctsMovementId: origMovementId,
    correctedOccurredAt,
    correctionReason: 'Worker picked up drill at 08:30 before site safety briefing, logged late at 10:30',
  });

  // Return for DRIL-001 later that day
  movements.push({
    _id: new Types.ObjectId(),
    type: 'RETURN',
    assetId: drill001._id,
    workerId: workersData[2]._id,
    reservationId: null,
    occurredAt: new Date(now.getTime() - 5 * dayMs + 17 * 3600 * 1000),
    recordedAt: new Date(now.getTime() - 5 * dayMs + 17 * 3600 * 1000),
    keeperName: 'Sam Taylor',
    actor: 'KEEPER',
    idempotencyKey: 'seed-return-dril001',
    condition: 'OK',
  });

  // 7. Outstanding issues (currently held)
  // e.g. DRIL-002 held by David Kim (walk-in, no reservation -> NOT overdue)
  const dril002 = assets.find((a) => a.code === 'DRIL-002')!;
  dril002.currentHolder = workersData[2]._id;
  movements.push({
    _id: new Types.ObjectId(),
    type: 'ISSUE',
    assetId: dril002._id,
    workerId: workersData[2]._id,
    reservationId: null,
    occurredAt: new Date(now.getTime() - 2 * 3600 * 1000),
    recordedAt: new Date(now.getTime() - 2 * 3600 * 1000),
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-current-issue-dril002',
  });

  // GASD-001 held by Liam Chen (valid Confined Spaces cert)
  const gasd001 = assets.find((a) => a.code === 'GASD-001')!;
  gasd001.currentHolder = workersData[4]._id;
  movements.push({
    _id: new Types.ObjectId(),
    type: 'ISSUE',
    assetId: gasd001._id,
    workerId: workersData[4]._id,
    reservationId: null,
    occurredAt: new Date(now.getTime() - 4 * 3600 * 1000),
    recordedAt: new Date(now.getTime() - 4 * 3600 * 1000),
    keeperName: 'Jordan Lee',
    actor: 'KEEPER',
    idempotencyKey: 'seed-current-issue-gasd001',
  });

  // 8. Overdue requirement (§9, §4):
  // "at least 1 overdue (issued against a reservation whose window has passed)"
  // e.g. HARN-001 issued against a reservation whose window ended 24 hours ago, worker still holds it!
  const overdueAsset = assets.find((a) => a.code === 'HARN-001')!;
  overdueAsset.currentHolder = workersData[3]._id; // Sarah Connor (has valid Heights cert)

  const overdueResId = new Types.ObjectId();
  const overdueResStart = new Date(now.getTime() - 3 * dayMs);
  const overdueResEnd = new Date(now.getTime() - 1 * dayMs); // window ended yesterday

  reservations.push({
    _id: overdueResId,
    assetId: overdueAsset._id,
    workerId: workersData[3]._id,
    windowStart: overdueResStart,
    windowEnd: overdueResEnd,
    status: 'FULFILLED',
    createdAt: new Date(now.getTime() - 5 * dayMs),
  });

  movements.push({
    _id: new Types.ObjectId(),
    type: 'RESERVE',
    assetId: overdueAsset._id,
    workerId: workersData[3]._id,
    reservationId: overdueResId,
    occurredAt: new Date(now.getTime() - 5 * dayMs),
    recordedAt: new Date(now.getTime() - 5 * dayMs),
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-reserve-overdue-harn001',
  });

  movements.push({
    _id: new Types.ObjectId(),
    type: 'ISSUE',
    assetId: overdueAsset._id,
    workerId: workersData[3]._id,
    reservationId: overdueResId,
    occurredAt: overdueResStart,
    recordedAt: overdueResStart,
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-issue-overdue-harn001',
  });

  // 9. Uncollected reservation requirement (§9):
  // "including one that was never collected (window passed, never converted to an ISSUE)"
  // e.g. GENR-001 reserved 4 days ago for window 3 days ago to 2 days ago, never picked up
  const uncollectedAsset = assets.find((a) => a.code === 'GENR-001')!;
  const uncollectedResId = new Types.ObjectId();
  reservations.push({
    _id: uncollectedResId,
    assetId: uncollectedAsset._id,
    workerId: workersData[6]._id, // Fatima
    windowStart: new Date(now.getTime() - 3 * dayMs),
    windowEnd: new Date(now.getTime() - 2 * dayMs),
    status: 'PENDING', // Still PENDING, uncollected
    createdAt: new Date(now.getTime() - 4 * dayMs),
  });
  movements.push({
    _id: new Types.ObjectId(),
    type: 'RESERVE',
    assetId: uncollectedAsset._id,
    workerId: workersData[6]._id,
    reservationId: uncollectedResId,
    occurredAt: new Date(now.getTime() - 4 * dayMs),
    recordedAt: new Date(now.getTime() - 4 * dayMs),
    keeperName: 'Sam Taylor',
    actor: 'KEEPER',
    idempotencyKey: 'seed-uncollected-reserve-genr001',
  });

  // 10. Future active reservations
  // e.g. TRIP-001 reserved for tomorrow
  const futureTripod = assets.find((a) => a.code === 'TRIP-001')!;
  const futureResId = new Types.ObjectId();
  reservations.push({
    _id: futureResId,
    assetId: futureTripod._id,
    workerId: workersData[1]._id, // Elena Rostova
    windowStart: new Date(now.getTime() + 1 * dayMs),
    windowEnd: new Date(now.getTime() + 2 * dayMs),
    status: 'PENDING',
    createdAt: new Date(),
  });
  movements.push({
    _id: new Types.ObjectId(),
    type: 'RESERVE',
    assetId: futureTripod._id,
    workerId: workersData[1]._id,
    reservationId: futureResId,
    occurredAt: new Date(),
    recordedAt: new Date(),
    keeperName: 'Alex Morgan',
    actor: 'KEEPER',
    idempotencyKey: 'seed-future-reserve-trip001',
  });

  // Write to Mongo
  await db.collection('assets').insertMany(assets);
  await db.collection('reservations').insertMany(reservations);
  await db.collection('movements').insertMany(movements);

  console.log(`Successfully seeded:`);
  console.log(`- ${assets.length} assets (2 out of service, 3 currently issued)`);
  console.log(`- ${workersData.length} workers (1 expired cert, 1 expiring in 12 days)`);
  console.log(`- ${reservations.length} reservations (including 1 uncollected, 1 overdue)`);
  console.log(`- ${movements.length} ledger movements (including late-logged and correction)`);

  await mongoose.disconnect();
  console.log('Seed completed successfully.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
