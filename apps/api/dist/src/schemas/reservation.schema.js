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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationSchema = exports.Reservation = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Reservation = class Reservation {
};
exports.Reservation = Reservation;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Asset', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Reservation.prototype, "assetId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Worker', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Reservation.prototype, "workerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Reservation.prototype, "windowStart", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Reservation.prototype, "windowEnd", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['PENDING', 'FULFILLED', 'CANCELLED'],
        default: 'PENDING',
        index: true,
    }),
    __metadata("design:type", String)
], Reservation.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Reservation.prototype, "createdAt", void 0);
exports.Reservation = Reservation = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false }, collection: 'reservations' })
], Reservation);
exports.ReservationSchema = mongoose_1.SchemaFactory.createForClass(Reservation);
exports.ReservationSchema.index({ assetId: 1, windowStart: 1, windowEnd: 1 });
//# sourceMappingURL=reservation.schema.js.map