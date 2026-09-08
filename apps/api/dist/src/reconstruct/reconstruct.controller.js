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
exports.ReconstructController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reconstruct_service_1 = require("./reconstruct.service");
let ReconstructController = class ReconstructController {
    constructor(reconstructService) {
        this.reconstructService = reconstructService;
    }
    async reconstructStore(asOf) {
        return this.reconstructService.reconstructStore(asOf);
    }
};
exports.ReconstructController = ReconstructController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Reconstruct the whole store state as it stood at any past instant (§6.6)',
        description: 'Folds all ledger movements up to asOf live per request, honoring latest corrections.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'asOf',
        required: false,
        description: 'ISO 8601 timestamp (e.g. 2026-09-08T14:20:00Z). Defaults to now.',
    }),
    __param(0, (0, common_1.Query)('asOf')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReconstructController.prototype, "reconstructStore", null);
exports.ReconstructController = ReconstructController = __decorate([
    (0, swagger_1.ApiTags)('reconstruct'),
    (0, common_1.Controller)('reconstruct'),
    __metadata("design:paramtypes", [reconstruct_service_1.ReconstructService])
], ReconstructController);
//# sourceMappingURL=reconstruct.controller.js.map