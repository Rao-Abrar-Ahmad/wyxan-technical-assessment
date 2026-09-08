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
exports.MovementsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const movements_service_1 = require("./movements.service");
const correct_movement_dto_1 = require("./dto/correct-movement.dto");
let MovementsController = class MovementsController {
    constructor(movementsService) {
        this.movementsService = movementsService;
    }
    async correctMovement(id, dto) {
        return this.movementsService.recordCorrection(id, dto);
    }
};
exports.MovementsController = MovementsController;
__decorate([
    (0, common_1.Post)(':id/correct'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Correct the occurredAt timestamp of an earlier movement (ADR-0001 / §6.5)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Correction recorded successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Original movement not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Idempotency key reused with mismatched payload' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Business rule refusal' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, correct_movement_dto_1.CorrectMovementDto]),
    __metadata("design:returntype", Promise)
], MovementsController.prototype, "correctMovement", null);
exports.MovementsController = MovementsController = __decorate([
    (0, swagger_1.ApiTags)('movements'),
    (0, common_1.Controller)('movements'),
    __metadata("design:paramtypes", [movements_service_1.MovementsService])
], MovementsController);
//# sourceMappingURL=movements.controller.js.map