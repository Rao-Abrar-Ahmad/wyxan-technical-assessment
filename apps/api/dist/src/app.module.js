"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("./database/database.module");
const assets_module_1 = require("./assets/assets.module");
const workers_module_1 = require("./workers/workers.module");
const reservations_module_1 = require("./reservations/reservations.module");
const movements_module_1 = require("./movements/movements.module");
const reconstruct_module_1 = require("./reconstruct/reconstruct.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env', '../../.env'],
            }),
            database_module_1.DatabaseModule,
            assets_module_1.AssetsModule,
            workers_module_1.WorkersModule,
            reservations_module_1.ReservationsModule,
            movements_module_1.MovementsModule,
            reconstruct_module_1.ReconstructModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map