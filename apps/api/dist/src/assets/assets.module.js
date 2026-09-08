"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const asset_schema_1 = require("../schemas/asset.schema");
const movement_schema_1 = require("../schemas/movement.schema");
const reservation_schema_1 = require("../schemas/reservation.schema");
const assets_controller_1 = require("./assets.controller");
const assets_service_1 = require("./assets.service");
const movements_module_1 = require("../movements/movements.module");
let AssetsModule = class AssetsModule {
};
exports.AssetsModule = AssetsModule;
exports.AssetsModule = AssetsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: asset_schema_1.Asset.name, schema: asset_schema_1.AssetSchema },
                { name: movement_schema_1.Movement.name, schema: movement_schema_1.MovementSchema },
                { name: reservation_schema_1.Reservation.name, schema: reservation_schema_1.ReservationSchema },
            ]),
            movements_module_1.MovementsModule,
        ],
        controllers: [assets_controller_1.AssetsController],
        providers: [assets_service_1.AssetsService],
        exports: [assets_service_1.AssetsService],
    })
], AssetsModule);
//# sourceMappingURL=assets.module.js.map