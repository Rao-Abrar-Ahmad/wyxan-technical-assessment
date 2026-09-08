import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import mongoose, { Types, Connection } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { v4 as uuidv4 } from 'uuid';

describe('Equipment Ledger - Invariant & Concurrency Test Suite (§10)', () => {
  let app: INestApplication;
  let replSet: MongoMemoryReplSet | null = null;
  let dbConnection: Connection;

  beforeAll(async () => {
    // If no MONGODB_URI is provided, boot an in-memory replica set
    if (!process.env.MONGODB_URI) {
      replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
      });
      process.env.MONGODB_URI = replSet.getUri('test-ledger');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const dbService = app.get<DatabaseService>(DatabaseService);
    dbConnection = dbService.getConnection();
  }, 600000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (replSet) {
      await replSet.stop();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    // Clean all collections before each test
    const collections = dbConnection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  /**
   * INVARIANT 1: Concurrency & Mutual Exclusion (ADR-0001 / §10.1)
   * Fire N concurrent issue requests for the same in-store asset.
   * Assert exactly one 201 Created, the rest 409 Conflict.
   * Assert directly in Mongo that exactly one ISSUE Movement exists and currentHolder matches winner.
   */
  it('1. Concurrency: exactly one winner under simultaneous issue requests', async () => {
    // Setup 1 asset and 5 workers
    const assetId = new Types.ObjectId();
    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'DRIL-999',
      kind: 'drill',
      requiresCertification: null,
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });

    const workers = await Promise.all(
      Array.from({ length: 5 }).map((_, i) => {
        const wid = new Types.ObjectId();
        return dbConnection.collection('workers').insertOne({
          _id: wid,
          name: `Worker ${i + 1}`,
          certifications: [],
          createdAt: new Date(),
        }).then(() => wid);
      }),
    );

    // Fire 5 concurrent requests simultaneously
    const responses = await Promise.all(
      workers.map((wId) =>
        request(app.getHttpServer())
          .post(`/assets/${assetId}/issue`)
          .send({
            workerId: wId.toString(),
            idempotencyKey: uuidv4(),
            keeperName: 'Alex Morgan',
          }),
      ),
    );

    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(4);

    const winningResponse = responses.find((r) => r.status === 201);
    const winningWorkerId = winningResponse?.body.workerId;

    // Direct database verification
    const dbAsset = await dbConnection.collection('assets').findOne({ _id: assetId });
    expect(dbAsset?.currentHolder.toString()).toBe(winningWorkerId.toString());

    const issueMovements = await dbConnection
      .collection('movements')
      .find({ assetId, type: 'ISSUE' })
      .toArray();

    expect(issueMovements.length).toBe(1);
    expect(issueMovements[0].workerId.toString()).toBe(winningWorkerId.toString());
  });

  /**
   * INVARIANT 2: Idempotency (§6.2 / §10.2)
   * Replay same request twice with same key -> identical response and 1 movement.
   * Replay with same key but different payload -> 409 Conflict.
   */
  it('2. Idempotency: exact replay succeeds without duplication; altered payload fails with 409', async () => {
    const assetId = new Types.ObjectId();
    const workerId = new Types.ObjectId();
    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'LADD-001',
      kind: 'ladder',
      requiresCertification: null,
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });
    await dbConnection.collection('workers').insertOne({
      _id: workerId,
      name: 'Worker Alpha',
      certifications: [],
      createdAt: new Date(),
    });

    const key = uuidv4();
    const payload = {
      workerId: workerId.toString(),
      idempotencyKey: key,
      keeperName: 'Sam Taylor',
    };

    // 1st submit
    const res1 = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send(payload);
    expect(res1.status).toBe(201);

    // Replay with identical payload
    const res2 = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send(payload);
    expect(res2.status).toBe(201);
    expect(res2.body._id).toBe(res1.body._id);

    // Database check: exactly one movement created
    const movements = await dbConnection
      .collection('movements')
      .find({ idempotencyKey: key })
      .toArray();
    expect(movements.length).toBe(1);

    // Replay with different payload (different worker) -> 409 Conflict
    const otherWorkerId = new Types.ObjectId();
    const res3 = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send({
        workerId: otherWorkerId.toString(),
        idempotencyKey: key,
      });
    expect(res3.status).toBe(409);
  });

  /**
   * INVARIANT 3: Reservation Overlap (§6.3 / §10.3)
   * Overlapping windows on same asset cannot both succeed.
   */
  it('3. Reservation Overlap: concurrent overlapping requests allow exactly one winner', async () => {
    const assetId = new Types.ObjectId();
    const worker1 = new Types.ObjectId();
    const worker2 = new Types.ObjectId();

    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'GENR-100',
      kind: 'generator',
      requiresCertification: null,
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });

    const start = new Date('2026-10-01T08:00:00Z');
    const end = new Date('2026-10-01T16:00:00Z');

    // Fire 2 overlapping reservations
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/assets/${assetId}/reserve`)
        .send({
          workerId: worker1.toString(),
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          idempotencyKey: uuidv4(),
        }),
      request(app.getHttpServer())
        .post(`/assets/${assetId}/reserve`)
        .send({
          workerId: worker2.toString(),
          windowStart: new Date('2026-10-01T12:00:00Z').toISOString(), // overlaps
          windowEnd: new Date('2026-10-01T18:00:00Z').toISOString(),
          idempotencyKey: uuidv4(),
        }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    const activeReservations = await dbConnection
      .collection('reservations')
      .find({ assetId, status: 'PENDING' })
      .toArray();
    expect(activeReservations.length).toBe(1);
  });

  /**
   * INVARIANT 4: Certification Gate (§4 / §6.1 / §10.4)
   * Issue against worker with expired cert (or expiring today) returns 422 with reason.
   */
  it('4. Certification Gate: refuses issue when certification is expired or expiring today', async () => {
    const assetId = new Types.ObjectId();
    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'HARN-500',
      kind: 'harness',
      requiresCertification: 'Working at Heights',
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });

    const today = new Date();
    // Worker whose cert expired yesterday
    const workerExpired = new Types.ObjectId();
    await dbConnection.collection('workers').insertOne({
      _id: workerExpired,
      name: 'Bob Expired',
      certifications: [
        {
          type: 'Working at Heights',
          expiryDate: new Date(today.getTime() - 24 * 3600 * 1000),
        },
      ],
      createdAt: new Date(),
    });

    const resExpired = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send({
        workerId: workerExpired.toString(),
        idempotencyKey: uuidv4(),
      });

    expect(resExpired.status).toBe(422);
    expect(resExpired.body.message).toMatch(/expired/i);

    // Worker whose cert expires today (UTC) - also treated as expired per §4
    const workerExpiringToday = new Types.ObjectId();
    await dbConnection.collection('workers').insertOne({
      _id: workerExpiringToday,
      name: 'Alice Today',
      certifications: [
        {
          type: 'Working at Heights',
          expiryDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
        },
      ],
      createdAt: new Date(),
    });

    const resToday = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send({
        workerId: workerExpiringToday.toString(),
        idempotencyKey: uuidv4(),
      });

    expect(resToday.status).toBe(422);
    expect(resToday.body.message).toMatch(/expired/i);
  });

  /**
   * INVARIANT 5: Out of Service & Auto-Cancellation (ADR-0002 / §10.5)
   * Attempt issue/reserve against out-of-service asset returns 422.
   * Marking in-store asset out of service auto-cancels standing reservations with actor: "SYSTEM".
   */
  it('5. Out-of-Service: blocks issue/reserve and auto-cancels standing reservations with SYSTEM actor', async () => {
    const assetId = new Types.ObjectId();
    const workerId = new Types.ObjectId();

    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'TRIP-300',
      kind: 'tripod',
      requiresCertification: null,
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });
    await dbConnection.collection('workers').insertOne({
      _id: workerId,
      name: 'Worker Reserver',
      certifications: [],
      createdAt: new Date(),
    });

    // Create a standing future reservation
    const futureStart = new Date(Date.now() + 24 * 3600 * 1000);
    const futureEnd = new Date(Date.now() + 48 * 3600 * 1000);

    const reserveRes = await request(app.getHttpServer())
      .post(`/assets/${assetId}/reserve`)
      .send({
        workerId: workerId.toString(),
        windowStart: futureStart.toISOString(),
        windowEnd: futureEnd.toISOString(),
        idempotencyKey: uuidv4(),
      });
    expect(reserveRes.status).toBe(201);

    // Take the in-store asset out of service
    const oosRes = await request(app.getHttpServer())
      .post(`/assets/${assetId}/out-of-service`)
      .send({ idempotencyKey: uuidv4() });
    expect(oosRes.status).toBe(200);

    // Verify reservation status is CANCELLED
    const cancelledRes = await dbConnection
      .collection('reservations')
      .findOne({ assetId });
    expect(cancelledRes?.status).toBe('CANCELLED');

    // Verify SYSTEM actor movement exists for the cancellation
    const cancelMovements = await dbConnection
      .collection('movements')
      .find({ assetId, type: 'CANCEL_RESERVATION', actor: 'SYSTEM' })
      .toArray();
    expect(cancelMovements.length).toBe(1);

    // Attempting to issue this out-of-service asset now must return 422
    const issueAttempt = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send({
        workerId: workerId.toString(),
        idempotencyKey: uuidv4(),
      });
    expect(issueAttempt.status).toBe(422);
  });

  /**
   * INVARIANT 6: Correction & Reconstruction (§6.5 / §6.6 / §10.6)
   * When a movement's timestamp is corrected, /reconstruct?asOf= uses the corrected timestamp
   * for state folding, while history endpoint shows the original.
   */
  it('6. Correction & Reconstruction: correction amends state folding timestamp while preserving history', async () => {
    const assetId = new Types.ObjectId();
    const workerId = new Types.ObjectId();

    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'RADI-500',
      kind: 'radio',
      requiresCertification: null,
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });
    await dbConnection.collection('workers').insertOne({
      _id: workerId,
      name: 'Radio Operator',
      certifications: [],
      createdAt: new Date(),
    });

    // Create an issue movement with occurredAt = 12:00
    const issueRes = await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send({
        workerId: workerId.toString(),
        occurredAt: '2026-09-08T12:00:00Z',
        idempotencyKey: uuidv4(),
      });
    expect(issueRes.status).toBe(201);
    const issueMovementId = issueRes.body._id;

    // Check reconstruct at 10:00 (before issue) -> IN_STORE
    const reconBefore = await request(app.getHttpServer())
      .get('/reconstruct?asOf=2026-09-08T10:00:00Z');
    const assetBefore = reconBefore.body.assets.find((a: any) => a._id === assetId.toString());
    expect(assetBefore.status).toBe('IN_STORE');

    // Now submit a CORRECTION: occurredAt was actually 09:00!
    const correctRes = await request(app.getHttpServer())
      .post(`/movements/${issueMovementId}/correct`)
      .send({
        correctedOccurredAt: '2026-09-08T09:00:00Z',
        correctionReason: 'Worker picked up early at 09:00',
        idempotencyKey: uuidv4(),
      });
    expect(correctRes.status).toBe(201);

    // Reconstruct at 10:00 should NOW show ISSUED because the corrected time (09:00) is authoritative!
    const reconAfterCorrection = await request(app.getHttpServer())
      .get('/reconstruct?asOf=2026-09-08T10:00:00Z');
    const assetAfter = reconAfterCorrection.body.assets.find((a: any) => a._id === assetId.toString());
    expect(assetAfter.status).toBe('ISSUED');
    expect(assetAfter.currentHolder._id).toBe(workerId.toString());

    // History view still shows original movement with occurredAt: 12:00 and marks it corrected
    const historyRes = await request(app.getHttpServer())
      .get(`/assets/${assetId}/history`);
    const originalInHistory = historyRes.body.history.find((m: any) => m._id === issueMovementId);
    expect(new Date(originalInHistory.occurredAt).toISOString()).toBe('2026-09-08T12:00:00.000Z');
    expect(originalInHistory.isCorrected).toBe(true);
    expect(originalInHistory.corrections.length).toBe(1);
  });

  /**
   * INVARIANT 7: Backdating Edge Cases (§10.7)
   * Return with occurredAt before corresponding issue's occurredAt is rejected with 422.
   */
  it('7. Backdating Edge Cases: return before issue occurredAt is rejected', async () => {
    const assetId = new Types.ObjectId();
    const workerId = new Types.ObjectId();

    await dbConnection.collection('assets').insertOne({
      _id: assetId,
      code: 'GRND-200',
      kind: 'grinder',
      requiresCertification: null,
      currentHolder: null,
      isOutOfService: false,
      createdAt: new Date(),
    });
    await dbConnection.collection('workers').insertOne({
      _id: workerId,
      name: 'Grinder Worker',
      certifications: [],
      createdAt: new Date(),
    });

    // Issue at 14:00
    await request(app.getHttpServer())
      .post(`/assets/${assetId}/issue`)
      .send({
        workerId: workerId.toString(),
        occurredAt: '2026-09-08T14:00:00Z',
        idempotencyKey: uuidv4(),
      });

    // Attempt to return at 13:00 (before issue occurredAt)
    const invalidReturn = await request(app.getHttpServer())
      .post(`/assets/${assetId}/return`)
      .send({
        condition: 'OK',
        occurredAt: '2026-09-08T13:00:00Z', // Before 14:00!
        idempotencyKey: uuidv4(),
      });

    expect(invalidReturn.status).toBe(422);
    expect(invalidReturn.body.message).toMatch(/cannot be before the corresponding issue/i);
  });
});
