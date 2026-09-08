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
exports.IssueAssetDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class IssueAssetDto {
}
exports.IssueAssetDto = IssueAssetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the worker receiving the asset', example: '652f10b7a812345678901234' }),
    (0, class_validator_1.IsMongoId)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], IssueAssetDto.prototype, "workerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional reservation ID being fulfilled', example: '652f10b7a812345678905678' }),
    (0, class_validator_1.IsMongoId)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], IssueAssetDto.prototype, "reservationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], IssueAssetDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], IssueAssetDto.prototype, "keeperName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Occurred timestamp (ISO 8601)', example: '2026-09-08T10:00:00Z' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], IssueAssetDto.prototype, "occurredAt", void 0);
//# sourceMappingURL=issue-asset.dto.js.map