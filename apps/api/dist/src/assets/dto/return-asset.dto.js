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
exports.ReturnAssetDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ReturnAssetDto {
}
exports.ReturnAssetDto = ReturnAssetDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ID of worker physically returning the asset (defaults to current holder)', example: '652f10b7a812345678901234' }),
    (0, class_validator_1.IsMongoId)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReturnAssetDto.prototype, "workerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Condition upon return (OK or DAMAGED)', enum: ['OK', 'DAMAGED'], example: 'OK' }),
    (0, class_validator_1.IsIn)(['OK', 'DAMAGED']),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReturnAssetDto.prototype, "condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'When the return physically occurred (can be backdated)', example: '2026-09-08T11:40:00Z' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReturnAssetDto.prototype, "occurredAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReturnAssetDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReturnAssetDto.prototype, "keeperName", void 0);
//# sourceMappingURL=return-asset.dto.js.map