"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
exports.getMongoUri = getMongoUri;
exports.stopMemoryReplSet = stopMemoryReplSet;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const database_service_1 = require("./database.service");
const net = require("net");
const fs = require("fs");
const path = require("path");
let memoryReplSet = null;
async function isPortOpen(host, port, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let called = false;
        socket.setTimeout(timeoutMs);
        socket.on('connect', () => {
            called = true;
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            if (!called) {
                called = true;
                socket.destroy();
                resolve(false);
            }
        });
        socket.on('error', () => {
            if (!called) {
                called = true;
                socket.destroy();
                resolve(false);
            }
        });
        socket.connect(port, host);
    });
}
async function getMongoUri(configService) {
    const envUri = configService?.get('MONGODB_URI') || process.env.MONGODB_URI;
    if (envUri) {
        try {
            const parsed = new URL(envUri.replace('mongodb://', 'http://').replace('mongodb+srv://', 'http://'));
            const host = parsed.hostname || 'localhost';
            const port = parseInt(parsed.port, 10) || 27017;
            if (!envUri.includes('mongodb+srv://')) {
                const reachable = await isPortOpen(host, port, 1000);
                if (reachable) {
                    return envUri;
                }
                common_1.Logger.warn(`MongoDB at ${host}:${port} is not reachable. Falling back to in-memory replica set.`, 'DatabaseModule');
            }
            else {
                return envUri;
            }
        }
        catch {
            return envUri;
        }
    }
    if (!memoryReplSet) {
        const { MongoMemoryReplSet } = await Promise.resolve().then(() => require('mongodb-memory-server'));
        common_1.Logger.log('Starting local in-memory MongoDB Replica Set (rs0)...', 'DatabaseModule');
        memoryReplSet = await MongoMemoryReplSet.create({
            replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
        });
        const uri = memoryReplSet.getUri('equipment-ledger');
        process.env.MONGODB_URI = uri;
        try {
            const uriPath = path.resolve(process.cwd(), '.mongo-uri');
            fs.writeFileSync(uriPath, uri, 'utf8');
        }
        catch { }
        common_1.Logger.log(`Local in-memory MongoDB Replica Set ready at: ${uri}`, 'DatabaseModule');
        return uri;
    }
    return memoryReplSet.getUri('equipment-ledger');
}
async function stopMemoryReplSet() {
    if (memoryReplSet) {
        await memoryReplSet.stop();
        memoryReplSet = null;
    }
}
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => {
                    const uri = await getMongoUri(configService);
                    return {
                        uri,
                        autoIndex: true,
                    };
                },
                inject: [config_1.ConfigService],
            }),
        ],
        providers: [database_service_1.DatabaseService],
        exports: [database_service_1.DatabaseService, mongoose_1.MongooseModule],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map