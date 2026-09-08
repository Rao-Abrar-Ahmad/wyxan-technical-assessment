"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MovementsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const movement_schema_1 = require("../schemas/movement.schema");
const asset_schema_1 = require("../schemas/asset.schema");
const worker_schema_1 = require("../schemas/worker.schema");
const reservation_schema_1 = require("../schemas/reservation.schema");
const database_service_1 = require("../database/database.service");
let MovementsService = MovementsService_1 = class MovementsService {
    constructor(movementModel, assetModel, workerModel, reservationModel, databaseService) {
        this.movementModel = movementModel;
        this.assetModel = assetModel;
        this.workerModel = workerModel;
        this.reservationModel = reservationModel;
        this.databaseService = databaseService;
        this.logger = new common_1.Logger(MovementsService_1.name);
    }
    async checkIdempotency(idempotencyKey, semanticPayload) {
        const existing = await this.movementModel.findOne({ idempotencyKey });
        if (!existing) {
            return null;
        }
        for (const [key, val] of Object.entries(semanticPayload)) {
            if (val === undefined || val === null)
                continue;
            const existingVal = existing[key];
            if (existingVal instanceof mongoose_2.Types.ObjectId && val) {
                if (!existingVal.equals(new mongoose_2.Types.ObjectId(val))) {
                    throw new common_1.ConflictException('This action was already submitted with different details.');
                }
            }
            else if (existingVal instanceof Date && val) {
                if (existingVal.getTime() !== new Date(val).getTime()) {
                    throw new common_1.ConflictException('This action was already submitted with different details.');
                }
            }
            else if (existingVal !== undefined && existingVal !== null) {
                if (String(existingVal) !== String(val)) {
                    throw new common_1.ConflictException('This action was already submitted with different details.');
                }
            }
        }
        this.logger.log(`Idempotent replay for key ${idempotencyKey} (movement ${existing._id})`);
        return existing;
    }
    async recordIssue(assetIdStr, dto) {
        const assetId = new mongoose_2.Types.ObjectId(assetIdStr);
        const workerId = new mongoose_2.Types.ObjectId(dto.workerId);
        const reservationId = dto.reservationId
            ? new mongoose_2.Types.ObjectId(dto.reservationId)
            : null;
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'ISSUE',
            assetId,
            workerId,
        });
        if (replay)
            return replay;
        return this.databaseService.runInTransaction(async (session) => {
            const updatedAsset = await this.assetModel.findOneAndUpdate({
                _id: assetId,
                currentHolder: null,
                isOutOfService: false,
            }, {
                $set: { currentHolder: workerId },
            }, { session, new: false });
            if (!updatedAsset) {
                const currentAsset = await this.assetModel
                    .findById(assetId)
                    .session(session);
                if (!currentAsset) {
                    throw new common_1.NotFoundException(`Asset ${assetIdStr} not found.`);
                }
                if (currentAsset.isOutOfService) {
                    throw new common_1.UnprocessableEntityException('Asset is out of service.');
                }
                if (currentAsset.currentHolder) {
                    throw new common_1.ConflictException(`Asset is already held by worker ${currentAsset.currentHolder}.`);
                }
                throw new common_1.ConflictException('Concurrent conflict updating asset guard.');
            }
            if (updatedAsset.requiresCertification) {
                const worker = await this.workerModel
                    .findById(workerId)
                    .session(session);
                if (!worker) {
                    throw new common_1.NotFoundException(`Worker ${dto.workerId} not found.`);
                }
                const requiredCertType = updatedAsset.requiresCertification;
                const matchingCert = worker.certifications.find((c) => c.type.toLowerCase() === requiredCertType.toLowerCase());
                if (!matchingCert) {
                    throw new common_1.UnprocessableEntityException(`Worker ${worker.name} does not hold required certification: ${requiredCertType}.`);
                }
                const issueDate = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
                const issueCalendarDateUTC = new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), issueDate.getUTCDate()));
                const certExpiryDate = new Date(matchingCert.expiryDate);
                const certCalendarDateUTC = new Date(Date.UTC(certExpiryDate.getUTCFullYear(), certExpiryDate.getUTCMonth(), certExpiryDate.getUTCDate()));
                if (certCalendarDateUTC.getTime() <= issueCalendarDateUTC.getTime()) {
                    const expiryFormatted = certExpiryDate.toISOString().slice(0, 10);
                    throw new common_1.UnprocessableEntityException(`Worker certification '${requiredCertType}' expired on ${expiryFormatted}. Expired certificates cannot be used to issue equipment.`);
                }
            }
            if (reservationId) {
                await this.reservationModel.findByIdAndUpdate(reservationId, { $set: { status: 'FULFILLED' } }, { session });
            }
            const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
            const movement = new this.movementModel({
                type: 'ISSUE',
                assetId,
                workerId,
                reservationId,
                occurredAt,
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
            });
            try {
                await movement.save({ session });
            }
            catch (err) {
                if (err.code === 11000) {
                    const existing = await this.movementModel
                        .findOne({ idempotencyKey: dto.idempotencyKey })
                        .session(session);
                    if (existing)
                        return existing;
                }
                throw err;
            }
            return movement;
        });
    }
    async recordReturn(assetIdStr, dto) {
        const assetId = new mongoose_2.Types.ObjectId(assetIdStr);
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'RETURN',
            assetId,
        });
        if (replay)
            return replay;
        return this.databaseService.runInTransaction(async (session) => {
            const asset = await this.assetModel.findById(assetId).session(session);
            if (!asset) {
                throw new common_1.NotFoundException(`Asset ${assetIdStr} not found.`);
            }
            if (!asset.currentHolder) {
                throw new common_1.ConflictException('Asset is not currently issued.');
            }
            const returnOccurredAt = dto.occurredAt
                ? new Date(dto.occurredAt)
                : new Date();
            const latestIssue = await this.movementModel
                .findOne({ assetId, type: 'ISSUE' })
                .sort({ occurredAt: -1, recordedAt: -1 })
                .session(session);
            if (latestIssue && returnOccurredAt.getTime() < latestIssue.occurredAt.getTime()) {
                throw new common_1.UnprocessableEntityException(`Return occurredAt (${returnOccurredAt.toISOString()}) cannot be before the corresponding issue occurredAt (${latestIssue.occurredAt.toISOString()}).`);
            }
            const returningWorkerId = dto.workerId
                ? new mongoose_2.Types.ObjectId(dto.workerId)
                : asset.currentHolder;
            const isDamaged = dto.condition === 'DAMAGED';
            await this.assetModel.findOneAndUpdate({ _id: assetId, currentHolder: { $ne: null } }, {
                $set: {
                    currentHolder: null,
                    ...(isDamaged ? { isOutOfService: true } : {}),
                },
            }, { session });
            const returnMovement = new this.movementModel({
                type: 'RETURN',
                assetId,
                workerId: returningWorkerId,
                occurredAt: returnOccurredAt,
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
                condition: dto.condition,
            });
            await returnMovement.save({ session });
            if (isDamaged) {
                const outOfServiceMovement = new this.movementModel({
                    type: 'OUT_OF_SERVICE',
                    assetId,
                    workerId: returningWorkerId,
                    occurredAt: returnOccurredAt,
                    recordedAt: new Date(),
                    keeperName: dto.keeperName || 'Default Keeper',
                    actor: 'KEEPER',
                    idempotencyKey: `${dto.idempotencyKey}-oos`,
                    meta: { reason: 'Returned in damaged condition' },
                });
                await outOfServiceMovement.save({ session });
                await this.autoCancelStandingReservations(assetId, session);
            }
            return returnMovement;
        });
    }
    async autoCancelStandingReservations(assetId, session) {
        const now = new Date();
        const pendingReservations = await this.reservationModel
            .find({
            assetId,
            status: 'PENDING',
            windowEnd: { $gt: now },
        })
            .session(session);
        for (const res of pendingReservations) {
            res.status = 'CANCELLED';
            await res.save({ session });
            const cancelMovement = new this.movementModel({
                type: 'CANCEL_RESERVATION',
                assetId,
                workerId: res.workerId,
                reservationId: res._id,
                occurredAt: now,
                recordedAt: now,
                keeperName: 'System',
                actor: 'SYSTEM',
                idempotencyKey: `system-cancel-${res._id}-${Date.now()}`,
                meta: { reason: 'Asset marked out of service (ADR-0002)' },
            });
            await cancelMovement.save({ session });
        }
    }
    async recordReserve(assetIdStr, dto) {
        const assetId = new mongoose_2.Types.ObjectId(assetIdStr);
        const workerId = new mongoose_2.Types.ObjectId(dto.workerId);
        const windowStart = new Date(dto.windowStart);
        const windowEnd = new Date(dto.windowEnd);
        if (windowEnd.getTime() <= windowStart.getTime()) {
            throw new common_1.UnprocessableEntityException('Window end must be strictly after window start.');
        }
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'RESERVE',
            assetId,
            workerId,
        });
        if (replay && replay.reservationId) {
            const existingRes = await this.reservationModel.findById(replay.reservationId);
            if (existingRes) {
                return { reservation: existingRes, movement: replay };
            }
        }
        return this.databaseService.runInTransaction(async (session) => {
            const asset = await this.assetModel.findOneAndUpdate({ _id: assetId, isOutOfService: false }, { $inc: { __v: 1 } }, { session, new: true });
            if (!asset) {
                const currentAsset = await this.assetModel.findById(assetId).session(session);
                if (!currentAsset) {
                    throw new common_1.NotFoundException(`Asset ${assetIdStr} not found.`);
                }
                if (currentAsset.isOutOfService) {
                    throw new common_1.UnprocessableEntityException('Cannot reserve an asset that is out of service.');
                }
                throw new common_1.ConflictException('Concurrent conflict updating asset reservation.');
            }
            const overlap = await this.reservationModel
                .findOne({
                assetId,
                status: { $ne: 'CANCELLED' },
                windowStart: { $lt: windowEnd },
                windowEnd: { $gt: windowStart },
            })
                .session(session);
            if (overlap) {
                throw new common_1.ConflictException(`Reservation overlaps with existing reservation ${overlap._id} (${overlap.windowStart.toISOString()} - ${overlap.windowEnd.toISOString()}).`);
            }
            const reservation = new this.reservationModel({
                assetId,
                workerId,
                windowStart,
                windowEnd,
                status: 'PENDING',
                createdAt: new Date(),
            });
            await reservation.save({ session });
            const movement = new this.movementModel({
                type: 'RESERVE',
                assetId,
                workerId,
                reservationId: reservation._id,
                occurredAt: new Date(),
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
            });
            await movement.save({ session });
            return { reservation, movement };
        });
    }
    async recordCancelReservation(reservationIdStr, dto) {
        const reservationId = new mongoose_2.Types.ObjectId(reservationIdStr);
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'CANCEL_RESERVATION',
            reservationId,
        });
        if (replay)
            return replay;
        return this.databaseService.runInTransaction(async (session) => {
            const reservation = await this.reservationModel
                .findById(reservationId)
                .session(session);
            if (!reservation) {
                throw new common_1.NotFoundException(`Reservation ${reservationIdStr} not found.`);
            }
            if (reservation.status === 'CANCELLED') {
                throw new common_1.ConflictException('Reservation is already cancelled.');
            }
            reservation.status = 'CANCELLED';
            await reservation.save({ session });
            const movement = new this.movementModel({
                type: 'CANCEL_RESERVATION',
                assetId: reservation.assetId,
                workerId: reservation.workerId,
                reservationId: reservation._id,
                occurredAt: new Date(),
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
                meta: { reason: dto.reason || 'Keeper cancelled reservation' },
            });
            await movement.save({ session });
            return movement;
        });
    }
    async recordOutOfService(assetIdStr, dto) {
        const assetId = new mongoose_2.Types.ObjectId(assetIdStr);
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'OUT_OF_SERVICE',
            assetId,
        });
        if (replay)
            return replay;
        return this.databaseService.runInTransaction(async (session) => {
            const asset = await this.assetModel.findById(assetId).session(session);
            if (!asset) {
                throw new common_1.NotFoundException(`Asset ${assetIdStr} not found.`);
            }
            if (asset.currentHolder !== null) {
                throw new common_1.UnprocessableEntityException('Cannot mark an issued asset out of service directly. Damage discovered while held must be processed through the Return flow with DAMAGED condition (ADR-0002).');
            }
            if (asset.isOutOfService) {
                throw new common_1.ConflictException('Asset is already out of service.');
            }
            asset.isOutOfService = true;
            await asset.save({ session });
            const movement = new this.movementModel({
                type: 'OUT_OF_SERVICE',
                assetId,
                workerId: null,
                occurredAt: new Date(),
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
            });
            await movement.save({ session });
            await this.autoCancelStandingReservations(assetId, session);
            return movement;
        });
    }
    async recordBackInService(assetIdStr, dto) {
        const assetId = new mongoose_2.Types.ObjectId(assetIdStr);
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'BACK_IN_SERVICE',
            assetId,
        });
        if (replay)
            return replay;
        return this.databaseService.runInTransaction(async (session) => {
            const asset = await this.assetModel.findById(assetId).session(session);
            if (!asset) {
                throw new common_1.NotFoundException(`Asset ${assetIdStr} not found.`);
            }
            if (!asset.isOutOfService) {
                throw new common_1.ConflictException('Asset is already in service.');
            }
            if (asset.currentHolder !== null) {
                throw new common_1.ConflictException('Asset cannot be brought back into service while held.');
            }
            asset.isOutOfService = false;
            await asset.save({ session });
            const movement = new this.movementModel({
                type: 'BACK_IN_SERVICE',
                assetId,
                workerId: null,
                occurredAt: new Date(),
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
            });
            await movement.save({ session });
            return movement;
        });
    }
    async recordCorrection(movementIdStr, dto) {
        const movementId = new mongoose_2.Types.ObjectId(movementIdStr);
        const replay = await this.checkIdempotency(dto.idempotencyKey, {
            type: 'CORRECTION',
            correctsMovementId: movementId,
        });
        if (replay)
            return replay;
        return this.databaseService.runInTransaction(async (session) => {
            const targetMovement = await this.movementModel
                .findById(movementId)
                .session(session);
            if (!targetMovement) {
                throw new common_1.NotFoundException(`Movement ${movementIdStr} to correct not found.`);
            }
            if (targetMovement.type === 'CORRECTION') {
                throw new common_1.UnprocessableEntityException('Cannot correct a correction movement.');
            }
            const correctedOccurredAt = new Date(dto.correctedOccurredAt);
            const correction = new this.movementModel({
                type: 'CORRECTION',
                assetId: targetMovement.assetId,
                workerId: targetMovement.workerId,
                reservationId: targetMovement.reservationId,
                occurredAt: targetMovement.occurredAt,
                recordedAt: new Date(),
                keeperName: dto.keeperName || 'Default Keeper',
                actor: 'KEEPER',
                idempotencyKey: dto.idempotencyKey,
                correctsMovementId: targetMovement._id,
                correctedOccurredAt,
                correctionReason: dto.correctionReason,
            });
            await correction.save({ session });
            return correction;
        });
    }
};
exports.MovementsService = MovementsService;
exports.MovementsService = MovementsService = MovementsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(movement_schema_1.Movement.name)),
    __param(1, (0, mongoose_1.InjectModel)(asset_schema_1.Asset.name)),
    __param(2, (0, mongoose_1.InjectModel)(worker_schema_1.Worker.name)),
    __param(3, (0, mongoose_1.InjectModel)(reservation_schema_1.Reservation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        database_service_1.DatabaseService])
], MovementsService);
//# sourceMappingURL=movements.service.js.map