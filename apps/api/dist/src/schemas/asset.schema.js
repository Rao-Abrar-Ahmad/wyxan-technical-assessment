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
exports.AssetSchema = exports.Asset = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Asset = class Asset {
};
exports.Asset = Asset;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], Asset.prototype, "code", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], Asset.prototype, "kind", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: null }),
    __metadata("design:type", String)
], Asset.prototype, "requiresCertification", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Worker', default: null, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Asset.prototype, "currentHolder", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false, index: true }),
    __metadata("design:type", Boolean)
], Asset.prototype, "isOutOfService", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Asset.prototype, "createdAt", void 0);
exports.Asset = Asset = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false }, collection: 'assets' })
], Asset);
exports.AssetSchema = mongoose_1.SchemaFactory.createForClass(Asset);
//# sourceMappingURL=asset.schema.js.map