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
exports.AssetsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const assets_service_1 = require("./assets.service");
const issue_asset_dto_1 = require("./dto/issue-asset.dto");
const return_asset_dto_1 = require("./dto/return-asset.dto");
const reserve_asset_dto_1 = require("./dto/reserve-asset.dto");
const action_idempotency_dto_1 = require("./dto/action-idempotency.dto");
let AssetsController = class AssetsController {
    constructor(assetsService) {
        this.assetsService = assetsService;
    }
    async findAll(kind, status) {
        return this.assetsService.findAll(kind, status);
    }
    async findOne(id) {
        return this.assetsService.findOne(id);
    }
    async getHistory(id, asOf) {
        return this.assetsService.getHistory(id, asOf);
    }
    async issue(id, dto) {
        return this.assetsService.issue(id, dto);
    }
    async returnAsset(id, dto) {
        return this.assetsService.returnAsset(id, dto);
    }
    async reserve(id, dto) {
        return this.assetsService.reserve(id, dto);
    }
    async outOfService(id, dto) {
        return this.assetsService.outOfService(id, dto);
    }
    async backInService(id, dto) {
        return this.assetsService.backInService(id, dto);
    }
};
exports.AssetsController = AssetsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all assets with computed operational statuses' }),
    (0, swagger_1.ApiQuery)({ name: 'kind', required: false, description: 'Filter by asset kind' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, description: 'Filter by status (IN_STORE, ISSUED, RESERVED, OUT_OF_SERVICE)' }),
    __param(0, (0, common_1.Query)('kind')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get details for a single asset' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full movement history for an asset with corrections and derived state' }),
    (0, swagger_1.ApiQuery)({ name: 'asOf', required: false, description: 'ISO 8601 instant to fold state up to' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('asOf')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Post)(':id/issue'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Issue an asset to a worker (ADR-0001)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Asset issued successfully' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Asset already held or idempotency conflict' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Worker lacks required certification or cert expired' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, issue_asset_dto_1.IssueAssetDto]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "issue", null);
__decorate([
    (0, common_1.Post)(':id/return'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Return an asset from a worker' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Asset returned successfully' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Asset is not currently issued' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Backdated before issue occurredAt' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, return_asset_dto_1.ReturnAssetDto]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "returnAsset", null);
__decorate([
    (0, common_1.Post)(':id/reserve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Reserve an asset for a time window' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Reservation created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Reservation window overlaps with existing reservation' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Asset is out of service or invalid window' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reserve_asset_dto_1.ReserveAssetDto]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "reserve", null);
__decorate([
    (0, common_1.Post)(':id/out-of-service'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Mark an in-store asset out of service (ADR-0002)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Asset marked out of service, pending reservations cancelled' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Cannot mark an issued asset out of service directly' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, action_idempotency_dto_1.ActionIdempotencyDto]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "outOfService", null);
__decorate([
    (0, common_1.Post)(':id/back-in-service'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Restore an out-of-service asset back into service' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Asset returned to service' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Asset is already in service' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, action_idempotency_dto_1.ActionIdempotencyDto]),
    __metadata("design:returntype", Promise)
], AssetsController.prototype, "backInService", null);
exports.AssetsController = AssetsController = __decorate([
    (0, swagger_1.ApiTags)('assets'),
    (0, common_1.Controller)('assets'),
    __metadata("design:paramtypes", [assets_service_1.AssetsService])
], AssetsController);
//# sourceMappingURL=assets.controller.js.map