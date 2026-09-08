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
exports.MovementSchema = exports.Movement = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Movement = class Movement {
};
exports.Movement = Movement;
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: [
            'ISSUE',
            'RETURN',
            'RESERVE',
            'CANCEL_RESERVATION',
            'OUT_OF_SERVICE',
            'BACK_IN_SERVICE',
            'CORRECTION',
        ],
        index: true,
    }),
    __metadata("design:type", String)
], Movement.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Asset', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Movement.prototype, "assetId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Worker', default: null, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Movement.prototype, "workerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Reservation', default: null, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Movement.prototype, "reservationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Date)
], Movement.prototype, "occurredAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: () => new Date(), index: true }),
    __metadata("design:type", Date)
], Movement.prototype, "recordedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 'Default Keeper' }),
    __metadata("design:type", String)
], Movement.prototype, "keeperName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['KEEPER', 'SYSTEM'], default: 'KEEPER' }),
    __metadata("design:type", String)
], Movement.prototype, "actor", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], Movement.prototype, "idempotencyKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Movement', default: null }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Movement.prototype, "correctsMovementId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Date)
], Movement.prototype, "correctedOccurredAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: null }),
    __metadata("design:type", String)
], Movement.prototype, "correctionReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['OK', 'DAMAGED', null], default: null }),
    __metadata("design:type", String)
], Movement.prototype, "condition", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.Mixed, default: null }),
    __metadata("design:type", Object)
], Movement.prototype, "meta", void 0);
exports.Movement = Movement = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: false,
        collection: 'movements',
    })
], Movement);
exports.MovementSchema = mongoose_1.SchemaFactory.createForClass(Movement);
exports.MovementSchema.index({ assetId: 1, occurredAt: 1 });
//# sourceMappingURL=movement.schema.js.map