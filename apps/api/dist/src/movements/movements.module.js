"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const movement_schema_1 = require("../schemas/movement.schema");
const asset_schema_1 = require("../schemas/asset.schema");
const worker_schema_1 = require("../schemas/worker.schema");
const reservation_schema_1 = require("../schemas/reservation.schema");
const movements_service_1 = require("./movements.service");
const movements_controller_1 = require("./movements.controller");
let MovementsModule = class MovementsModule {
};
exports.MovementsModule = MovementsModule;
exports.MovementsModule = MovementsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: movement_schema_1.Movement.name, schema: movement_schema_1.MovementSchema },
                { name: asset_schema_1.Asset.name, schema: asset_schema_1.AssetSchema },
                { name: worker_schema_1.Worker.name, schema: worker_schema_1.WorkerSchema },
                { name: reservation_schema_1.Reservation.name, schema: reservation_schema_1.ReservationSchema },
            ]),
        ],
        controllers: [movements_controller_1.MovementsController],
        providers: [movements_service_1.MovementsService],
        exports: [movements_service_1.MovementsService],
    })
], MovementsModule);
//# sourceMappingURL=movements.module.js.map