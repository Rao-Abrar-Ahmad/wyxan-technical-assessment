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
exports.WorkerSchema = exports.Worker = exports.CertificationSchema = exports.Certification = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Certification = class Certification {
};
exports.Certification = Certification;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Certification.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Certification.prototype, "expiryDate", void 0);
exports.Certification = Certification = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], Certification);
exports.CertificationSchema = mongoose_1.SchemaFactory.createForClass(Certification);
let Worker = class Worker {
};
exports.Worker = Worker;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], Worker.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.CertificationSchema], default: [] }),
    __metadata("design:type", Array)
], Worker.prototype, "certifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Worker.prototype, "createdAt", void 0);
exports.Worker = Worker = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false }, collection: 'workers' })
], Worker);
exports.WorkerSchema = mongoose_1.SchemaFactory.createForClass(Worker);
//# sourceMappingURL=worker.schema.js.map