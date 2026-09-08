import { Global, Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

let memoryReplSet: any = null;

async function isPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
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

export async function getMongoUri(configService?: ConfigService): Promise<string> {
  const envUri = configService?.get<string>('MONGODB_URI') || process.env.MONGODB_URI;

  // If MONGODB_URI is provided, check if it's reachable (e.g. localhost:27017 or Atlas)
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
        Logger.warn(`MongoDB at ${host}:${port} is not reachable. Falling back to in-memory replica set.`, 'DatabaseModule');
      } else {
        return envUri;
      }
    } catch {
      return envUri;
    }
  }

  // If no URI or local port not open, use / start MongoMemoryReplSet
  if (!memoryReplSet) {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    Logger.log('Starting local in-memory MongoDB Replica Set (rs0)...', 'DatabaseModule');
    memoryReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
    });
    const uri = memoryReplSet.getUri('equipment-ledger');
    process.env.MONGODB_URI = uri;

    // Save URI for seed and other tools
    try {
      const uriPath = path.resolve(process.cwd(), '.mongo-uri');
      fs.writeFileSync(uriPath, uri, 'utf8');
    } catch {}

    Logger.log(`Local in-memory MongoDB Replica Set ready at: ${uri}`, 'DatabaseModule');
    return uri;
  }

  return memoryReplSet.getUri('equipment-ledger');
}

export async function stopMemoryReplSet() {
  if (memoryReplSet) {
    await memoryReplSet.stop();
    memoryReplSet = null;
  }
}

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = await getMongoUri(configService);
        return {
          uri,
          autoIndex: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, MongooseModule],
})
export class DatabaseModule {}
