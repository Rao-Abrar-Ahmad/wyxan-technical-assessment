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
exports.ReservationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const reservation_schema_1 = require("../schemas/reservation.schema");
const movements_service_1 = require("../movements/movements.service");
let ReservationsService = class ReservationsService {
    constructor(reservationModel, movementsService) {
        this.reservationModel = reservationModel;
        this.movementsService = movementsService;
    }
    async findAll(assetId, status) {
        const query = {};
        if (assetId) {
            query.assetId = new mongoose_2.Types.ObjectId(assetId);
        }
        if (status) {
            query.status = status.toUpperCase();
        }
        return this.reservationModel
            .find(query)
            .populate('assetId', 'code kind')
            .populate('workerId', 'name')
            .sort({ windowStart: 1 })
            .lean();
    }
    async cancel(id, dto) {
        return this.movementsService.recordCancelReservation(id, dto);
    }
};
exports.ReservationsService = ReservationsService;
exports.ReservationsService = ReservationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(reservation_schema_1.Reservation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        movements_service_1.MovementsService])
], ReservationsService);
//# sourceMappingURL=reservations.service.js.map