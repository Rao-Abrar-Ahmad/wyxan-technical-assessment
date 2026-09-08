"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = require("supertest");
const mongoose_1 = require("mongoose");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const app_module_1 = require("../src/app.module");
const database_service_1 = require("../src/database/database.service");
const uuid_1 = require("uuid");
describe('Equipment Ledger - Invariant & Concurrency Test Suite (§10)', () => {
    let app;
    let replSet = null;
    let dbConnection;
    beforeAll(async () => {
        if (!process.env.MONGODB_URI) {
            replSet = await mongodb_memory_server_1.MongoMemoryReplSet.create({
                replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
            });
            process.env.MONGODB_URI = replSet.getUri('test-ledger');
        }
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        const dbService = app.get(database_service_1.DatabaseService);
        dbConnection = dbService.getConnection();
    }, 600000);
    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (replSet) {
            await replSet.stop();
        }
        if (mongoose_1.default.connection.readyState !== 0) {
            await mongoose_1.default.disconnect();
        }
    });
    beforeEach(async () => {
        const collections = dbConnection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    });
    it('1. Concurrency: exactly one winner under simultaneous issue requests', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
        await dbConnection.collection('assets').insertOne({
            _id: assetId,
            code: 'DRIL-999',
            kind: 'drill',
            requiresCertification: null,
            currentHolder: null,
            isOutOfService: false,
            createdAt: new Date(),
        });
        const workers = await Promise.all(Array.from({ length: 5 }).map((_, i) => {
            const wid = new mongoose_1.Types.ObjectId();
            return dbConnection.collection('workers').insertOne({
                _id: wid,
                name: `Worker ${i + 1}`,
                certifications: [],
                createdAt: new Date(),
            }).then(() => wid);
        }));
        const responses = await Promise.all(workers.map((wId) => request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send({
            workerId: wId.toString(),
            idempotencyKey: (0, uuid_1.v4)(),
            keeperName: 'Alex Morgan',
        })));
        const successCount = responses.filter((r) => r.status === 201).length;
        const conflictCount = responses.filter((r) => r.status === 409).length;
        expect(successCount).toBe(1);
        expect(conflictCount).toBe(4);
        const winningResponse = responses.find((r) => r.status === 201);
        const winningWorkerId = winningResponse?.body.workerId;
        const dbAsset = await dbConnection.collection('assets').findOne({ _id: assetId });
        expect(dbAsset?.currentHolder.toString()).toBe(winningWorkerId.toString());
        const issueMovements = await dbConnection
            .collection('movements')
            .find({ assetId, type: 'ISSUE' })
            .toArray();
        expect(issueMovements.length).toBe(1);
        expect(issueMovements[0].workerId.toString()).toBe(winningWorkerId.toString());
    });
    it('2. Idempotency: exact replay succeeds without duplication; altered payload fails with 409', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
        const workerId = new mongoose_1.Types.ObjectId();
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
        const key = (0, uuid_1.v4)();
        const payload = {
            workerId: workerId.toString(),
            idempotencyKey: key,
            keeperName: 'Sam Taylor',
        };
        const res1 = await request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send(payload);
        expect(res1.status).toBe(201);
        const res2 = await request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send(payload);
        expect(res2.status).toBe(201);
        expect(res2.body._id).toBe(res1.body._id);
        const movements = await dbConnection
            .collection('movements')
            .find({ idempotencyKey: key })
            .toArray();
        expect(movements.length).toBe(1);
        const otherWorkerId = new mongoose_1.Types.ObjectId();
        const res3 = await request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send({
            workerId: otherWorkerId.toString(),
            idempotencyKey: key,
        });
        expect(res3.status).toBe(409);
    });
    it('3. Reservation Overlap: concurrent overlapping requests allow exactly one winner', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
        const worker1 = new mongoose_1.Types.ObjectId();
        const worker2 = new mongoose_1.Types.ObjectId();
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
        const [res1, res2] = await Promise.all([
            request(app.getHttpServer())
                .post(`/assets/${assetId}/reserve`)
                .send({
                workerId: worker1.toString(),
                windowStart: start.toISOString(),
                windowEnd: end.toISOString(),
                idempotencyKey: (0, uuid_1.v4)(),
            }),
            request(app.getHttpServer())
                .post(`/assets/${assetId}/reserve`)
                .send({
                workerId: worker2.toString(),
                windowStart: new Date('2026-10-01T12:00:00Z').toISOString(),
                windowEnd: new Date('2026-10-01T18:00:00Z').toISOString(),
                idempotencyKey: (0, uuid_1.v4)(),
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
    it('4. Certification Gate: refuses issue when certification is expired or expiring today', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
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
        const workerExpired = new mongoose_1.Types.ObjectId();
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
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(resExpired.status).toBe(422);
        expect(resExpired.body.message).toMatch(/expired/i);
        const workerExpiringToday = new mongoose_1.Types.ObjectId();
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
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(resToday.status).toBe(422);
        expect(resToday.body.message).toMatch(/expired/i);
    });
    it('5. Out-of-Service: blocks issue/reserve and auto-cancels standing reservations with SYSTEM actor', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
        const workerId = new mongoose_1.Types.ObjectId();
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
        const futureStart = new Date(Date.now() + 24 * 3600 * 1000);
        const futureEnd = new Date(Date.now() + 48 * 3600 * 1000);
        const reserveRes = await request(app.getHttpServer())
            .post(`/assets/${assetId}/reserve`)
            .send({
            workerId: workerId.toString(),
            windowStart: futureStart.toISOString(),
            windowEnd: futureEnd.toISOString(),
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(reserveRes.status).toBe(201);
        const oosRes = await request(app.getHttpServer())
            .post(`/assets/${assetId}/out-of-service`)
            .send({ idempotencyKey: (0, uuid_1.v4)() });
        expect(oosRes.status).toBe(200);
        const cancelledRes = await dbConnection
            .collection('reservations')
            .findOne({ assetId });
        expect(cancelledRes?.status).toBe('CANCELLED');
        const cancelMovements = await dbConnection
            .collection('movements')
            .find({ assetId, type: 'CANCEL_RESERVATION', actor: 'SYSTEM' })
            .toArray();
        expect(cancelMovements.length).toBe(1);
        const issueAttempt = await request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send({
            workerId: workerId.toString(),
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(issueAttempt.status).toBe(422);
    });
    it('6. Correction & Reconstruction: correction amends state folding timestamp while preserving history', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
        const workerId = new mongoose_1.Types.ObjectId();
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
        const issueRes = await request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send({
            workerId: workerId.toString(),
            occurredAt: '2026-09-08T12:00:00Z',
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(issueRes.status).toBe(201);
        const issueMovementId = issueRes.body._id;
        const reconBefore = await request(app.getHttpServer())
            .get('/reconstruct?asOf=2026-09-08T10:00:00Z');
        const assetBefore = reconBefore.body.assets.find((a) => a._id === assetId.toString());
        expect(assetBefore.status).toBe('IN_STORE');
        const correctRes = await request(app.getHttpServer())
            .post(`/movements/${issueMovementId}/correct`)
            .send({
            correctedOccurredAt: '2026-09-08T09:00:00Z',
            correctionReason: 'Worker picked up early at 09:00',
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(correctRes.status).toBe(201);
        const reconAfterCorrection = await request(app.getHttpServer())
            .get('/reconstruct?asOf=2026-09-08T10:00:00Z');
        const assetAfter = reconAfterCorrection.body.assets.find((a) => a._id === assetId.toString());
        expect(assetAfter.status).toBe('ISSUED');
        expect(assetAfter.currentHolder._id).toBe(workerId.toString());
        const historyRes = await request(app.getHttpServer())
            .get(`/assets/${assetId}/history`);
        const originalInHistory = historyRes.body.history.find((m) => m._id === issueMovementId);
        expect(new Date(originalInHistory.occurredAt).toISOString()).toBe('2026-09-08T12:00:00.000Z');
        expect(originalInHistory.isCorrected).toBe(true);
        expect(originalInHistory.corrections.length).toBe(1);
    });
    it('7. Backdating Edge Cases: return before issue occurredAt is rejected', async () => {
        const assetId = new mongoose_1.Types.ObjectId();
        const workerId = new mongoose_1.Types.ObjectId();
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
        await request(app.getHttpServer())
            .post(`/assets/${assetId}/issue`)
            .send({
            workerId: workerId.toString(),
            occurredAt: '2026-09-08T14:00:00Z',
            idempotencyKey: (0, uuid_1.v4)(),
        });
        const invalidReturn = await request(app.getHttpServer())
            .post(`/assets/${assetId}/return`)
            .send({
            condition: 'OK',
            occurredAt: '2026-09-08T13:00:00Z',
            idempotencyKey: (0, uuid_1.v4)(),
        });
        expect(invalidReturn.status).toBe(422);
        expect(invalidReturn.body.message).toMatch(/cannot be before the corresponding issue/i);
    });
});
//# sourceMappingURL=invariants.spec.js.map