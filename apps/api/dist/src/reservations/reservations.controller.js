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
exports.ReservationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reservations_service_1 = require("./reservations.service");
const cancel_reservation_dto_1 = require("./dto/cancel-reservation.dto");
let ReservationsController = class ReservationsController {
    constructor(reservationsService) {
        this.reservationsService = reservationsService;
    }
    async findAll(assetId, status) {
        return this.reservationsService.findAll(assetId, status);
    }
    async cancel(id, dto) {
        return this.reservationsService.cancel(id, dto);
    }
};
exports.ReservationsController = ReservationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List reservations with optional asset and status filters' }),
    (0, swagger_1.ApiQuery)({ name: 'assetId', required: false, description: 'Filter by asset ID' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, description: 'Filter by status (PENDING, FULFILLED, CANCELLED)' }),
    __param(0, (0, common_1.Query)('assetId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a reservation' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Reservation cancelled successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Reservation not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Reservation already cancelled' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_reservation_dto_1.CancelReservationDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "cancel", null);
exports.ReservationsController = ReservationsController = __decorate([
    (0, swagger_1.ApiTags)('reservations'),
    (0, common_1.Controller)('reservations'),
    __metadata("design:paramtypes", [reservations_service_1.ReservationsService])
], ReservationsController);
//# sourceMappingURL=reservations.controller.js.map