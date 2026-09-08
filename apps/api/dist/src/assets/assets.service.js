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
exports.AssetsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const asset_schema_1 = require("../schemas/asset.schema");
const movement_schema_1 = require("../schemas/movement.schema");
const reservation_schema_1 = require("../schemas/reservation.schema");
const movements_service_1 = require("../movements/movements.service");
let AssetsService = class AssetsService {
    constructor(assetModel, movementModel, reservationModel, movementsService) {
        this.assetModel = assetModel;
        this.movementModel = movementModel;
        this.reservationModel = reservationModel;
        this.movementsService = movementsService;
    }
    async findAll(kind, status) {
        const query = {};
        if (kind) {
            query.kind = kind;
        }
        const assets = await this.assetModel
            .find(query)
            .populate('currentHolder', 'name certifications')
            .sort({ code: 1 })
            .lean();
        const now = new Date();
        const activeReservations = await this.reservationModel.find({
            status: 'PENDING',
            windowStart: { $lte: now },
            windowEnd: { $gte: now },
        }).populate('workerId', 'name').lean();
        const activeResByAsset = new Map();
        for (const res of activeReservations) {
            activeResByAsset.set(String(res.assetId), res);
        }
        const enriched = await Promise.all(assets.map(async (asset) => {
            let computedStatus = 'IN_STORE';
            let isOverdue = false;
            let reservationInfo = null;
            if (asset.isOutOfService) {
                computedStatus = 'OUT_OF_SERVICE';
            }
            else if (asset.currentHolder) {
                computedStatus = 'ISSUED';
                const latestIssue = await this.movementModel
                    .findOne({ assetId: asset._id, type: 'ISSUE' })
                    .sort({ occurredAt: -1, recordedAt: -1 })
                    .populate('reservationId')
                    .lean();
                if (latestIssue && latestIssue.reservationId) {
                    const res = latestIssue.reservationId;
                    if (res.windowEnd && new Date(res.windowEnd) < now) {
                        isOverdue = true;
                        reservationInfo = res;
                    }
                }
            }
            else if (activeResByAsset.has(String(asset._id))) {
                computedStatus = 'RESERVED';
                reservationInfo = activeResByAsset.get(String(asset._id));
            }
            return {
                ...asset,
                status: computedStatus,
                isOverdue,
                activeReservation: reservationInfo,
            };
        }));
        if (status) {
            return enriched.filter((a) => a.status.toUpperCase() === status.toUpperCase());
        }
        return enriched;
    }
    async findOne(id) {
        const asset = await this.assetModel
            .findById(id)
            .populate('currentHolder', 'name certifications')
            .lean();
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${id} not found.`);
        }
        const now = new Date();
        const upcomingReservations = await this.reservationModel
            .find({
            assetId: asset._id,
            status: 'PENDING',
            windowEnd: { $gt: now },
        })
            .populate('workerId', 'name')
            .sort({ windowStart: 1 })
            .lean();
        return {
            ...asset,
            upcomingReservations,
        };
    }
    async getHistory(id, asOfStr) {
        const asset = await this.assetModel.findById(id).lean();
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${id} not found.`);
        }
        const assetId = new mongoose_2.Types.ObjectId(id);
        const rawMovements = await this.movementModel
            .find({ assetId })
            .populate('workerId', 'name')
            .populate('correctsMovementId')
            .sort({ occurredAt: 1, recordedAt: 1 })
            .lean();
        const correctionsByOriginal = new Map();
        for (const m of rawMovements) {
            if (m.type === 'CORRECTION' && m.correctsMovementId) {
                const origId = String(m.correctsMovementId._id || m.correctsMovementId);
                const list = correctionsByOriginal.get(origId) || [];
                list.push(m);
                correctionsByOriginal.set(origId, list);
            }
        }
        const history = rawMovements.map((m) => {
            const corrections = correctionsByOriginal.get(String(m._id)) || [];
            const latestCorrection = corrections[corrections.length - 1];
            return {
                ...m,
                isCorrected: corrections.length > 0,
                corrections,
                effectiveOccurredAt: latestCorrection
                    ? latestCorrection.correctedOccurredAt
                    : m.occurredAt,
            };
        });
        let derivedState = null;
        if (asOfStr) {
            const asOf = new Date(asOfStr);
            derivedState = this.foldAssetMovementsAsOf(history, asOf);
        }
        return {
            asset,
            history,
            derivedState,
        };
    }
    foldAssetMovementsAsOf(movements, asOf) {
        const eligible = movements
            .filter((m) => new Date(m.effectiveOccurredAt).getTime() <= asOf.getTime())
            .sort((a, b) => new Date(a.effectiveOccurredAt).getTime() -
            new Date(b.effectiveOccurredAt).getTime());
        let holder = null;
        let isOutOfService = false;
        let lastMovement = null;
        for (const m of eligible) {
            lastMovement = m;
            switch (m.type) {
                case 'ISSUE':
                    holder = m.workerId;
                    break;
                case 'RETURN':
                    holder = null;
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
        return {
            asOf: asOf.toISOString(),
            currentHolder: holder,
            isOutOfService,
            lastMovement,
            status: isOutOfService ? 'OUT_OF_SERVICE' : holder ? 'ISSUED' : 'IN_STORE',
        };
    }
    async issue(id, dto) {
        return this.movementsService.recordIssue(id, dto);
    }
    async returnAsset(id, dto) {
        return this.movementsService.recordReturn(id, dto);
    }
    async reserve(id, dto) {
        return this.movementsService.recordReserve(id, dto);
    }
    async outOfService(id, dto) {
        return this.movementsService.recordOutOfService(id, dto);
    }
    async backInService(id, dto) {
        return this.movementsService.recordBackInService(id, dto);
    }
};
exports.AssetsService = AssetsService;
exports.AssetsService = AssetsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(asset_schema_1.Asset.name)),
    __param(1, (0, mongoose_1.InjectModel)(movement_schema_1.Movement.name)),
    __param(2, (0, mongoose_1.InjectModel)(reservation_schema_1.Reservation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        movements_service_1.MovementsService])
], AssetsService);
//# sourceMappingURL=assets.service.js.map