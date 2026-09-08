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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconstructService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const asset_schema_1 = require("../schemas/asset.schema");
const movement_schema_1 = require("../schemas/movement.schema");
const reservation_schema_1 = require("../schemas/reservation.schema");
const worker_schema_1 = require("../schemas/worker.schema");
let ReconstructService = class ReconstructService {
    constructor(assetModel, movementModel, reservationModel, workerModel) {
        this.assetModel = assetModel;
        this.movementModel = movementModel;
        this.reservationModel = reservationModel;
        this.workerModel = workerModel;
    }
    async reconstructStore(asOfStr) {
        const asOf = asOfStr ? new Date(asOfStr) : new Date();
        const [assets, workers, allReservations, rawMovements] = await Promise.all([
            this.assetModel.find().lean(),
            this.workerModel.find().lean(),
            this.reservationModel.find().lean(),
            this.movementModel.find().lean(),
        ]);
        const workersById = new Map(workers.map((w) => [String(w._id), w]));
        const reservationsById = new Map(allReservations.map((r) => [String(r._id), r]));
        const correctionsByTarget = new Map();
        for (const m of rawMovements) {
            if (m.type === 'CORRECTION' && m.correctsMovementId) {
                const targetId = String(m.correctsMovementId);
                const list = correctionsByTarget.get(targetId) || [];
                list.push(m);
                correctionsByTarget.set(targetId, list);
            }
        }
        const movementsWithEffective = rawMovements.map((m) => {
            const corrections = correctionsByTarget.get(String(m._id)) || [];
            corrections.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
            const latestCorrection = corrections[0];
            const effectiveOccurredAt = latestCorrection
                ? new Date(latestCorrection.correctedOccurredAt)
                : new Date(m.occurredAt);
            return {
                ...m,
                isCorrected: corrections.length > 0,
                corrections,
                effectiveOccurredAt,
            };
        });
        const movementsByAsset = new Map();
        for (const m of movementsWithEffective) {
            const aId = String(m.assetId);
            const list = movementsByAsset.get(aId) || [];
            list.push(m);
            movementsByAsset.set(aId, list);
        }
        const reconstructedAssets = assets.map((asset) => {
            const assetMovements = movementsByAsset.get(String(asset._id)) || [];
            const eligibleMovements = assetMovements
                .filter((m) => m.effectiveOccurredAt.getTime() <= asOf.getTime())
                .sort((a, b) => {
                const diff = a.effectiveOccurredAt.getTime() - b.effectiveOccurredAt.getTime();
                if (diff !== 0)
                    return diff;
                return new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
            });
            let currentHolderId = null;
            let isOutOfService = false;
            let lastIssueReservationId = null;
            let lastMovement = null;
            for (const m of eligibleMovements) {
                lastMovement = m;
                switch (m.type) {
                    case 'ISSUE':
                        currentHolderId = m.workerId;
                        lastIssueReservationId = m.reservationId;
                        break;
                    case 'RETURN':
                        currentHolderId = null;
                        lastIssueReservationId = null;
                        if (m.condition === 'DAMAGED') {
                            isOutOfService = true;
                        }
                        break;
                    case 'OUT_OF_SERVICE':
                        isOutOfService = true;
                        break;
                    case 'BACK_IN_SERVICE':
                        isOutOfService = false;
                        break;
                }
            }
            let isOverdue = false;
            let reservationWindowEnd = null;
            if (currentHolderId && lastIssueReservationId) {
                const res = reservationsById.get(String(lastIssueReservationId));
                if (res && res.windowEnd) {
                    reservationWindowEnd = new Date(res.windowEnd);
                    if (reservationWindowEnd.getTime() < asOf.getTime()) {
                        isOverdue = true;
                    }
                }
            }
            const activeRes = allReservations.find((r) => {
                if (String(r.assetId) !== String(asset._id))
                    return false;
                const start = new Date(r.windowStart);
                const end = new Date(r.windowEnd);
                if (start.getTime() > asOf.getTime() || end.getTime() < asOf.getTime()) {
                    return false;
                }
                const cancelMovement = assetMovements.find((m) => m.type === 'CANCEL_RESERVATION' &&
                    String(m.reservationId) === String(r._id) &&
                    m.effectiveOccurredAt.getTime() <= asOf.getTime());
                return !cancelMovement;
            });
            let status = 'IN_STORE';
            if (isOutOfService) {
                status = 'OUT_OF_SERVICE';
            }
            else if (currentHolderId) {
                status = 'ISSUED';
            }
            else if (activeRes) {
                status = 'RESERVED';
            }
            const holderWorker = currentHolderId
                ? workersById.get(String(currentHolderId)) || { _id: currentHolderId }
                : null;
            return {
                _id: asset._id,
                code: asset.code,
                kind: asset.kind,
                requiresCertification: asset.requiresCertification,
                status,
                isOutOfService,
                currentHolder: holderWorker,
                isOverdue,
                reservationWindowEnd,
                activeReservation: activeRes
                    ? {
                        ...activeRes,
                        worker: workersById.get(String(activeRes.workerId)),
                    }
                    : null,
                movementCountAsOf: eligibleMovements.length,
                lastMovementAsOf: lastMovement
                    ? {
                        type: lastMovement.type,
                        occurredAt: lastMovement.occurredAt,
                        effectiveOccurredAt: lastMovement.effectiveOccurredAt,
                        actor: lastMovement.actor,
                    }
                    : null,
            };
        });
        return {
            asOf: asOf.toISOString(),
            totalAssets: reconstructedAssets.length,
            inStoreCount: reconstructedAssets.filter((a) => a.status === 'IN_STORE').length,
            issuedCount: reconstructedAssets.filter((a) => a.status === 'ISSUED').length,
            reservedCount: reconstructedAssets.filter((a) => a.status === 'RESERVED').length,
            outOfServiceCount: reconstructedAssets.filter((a) => a.status === 'OUT_OF_SERVICE').length,
            overdueCount: reconstructedAssets.filter((a) => a.isOverdue).length,
            assets: reconstructedAssets,
        };
    }
};
exports.ReconstructService = ReconstructService;
exports.ReconstructService = ReconstructService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(asset_schema_1.Asset.name)),
    __param(1, (0, mongoose_1.InjectModel)(movement_schema_1.Movement.name)),
    __param(2, (0, mongoose_1.InjectModel)(reservation_schema_1.Reservation.name)),
    __param(3, (0, mongoose_1.InjectModel)(worker_schema_1.Worker.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ReconstructService);
//# sourceMappingURL=reconstruct.service.js.map