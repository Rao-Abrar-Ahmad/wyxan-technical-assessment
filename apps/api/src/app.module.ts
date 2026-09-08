import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AssetsModule } from './assets/assets.module';
import { WorkersModule } from './workers/workers.module';
import { ReservationsModule } from './reservations/reservations.module';
import { MovementsModule } from './movements/movements.module';
import { ReconstructModule } from './reconstruct/reconstruct.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    DatabaseModule,
    AssetsModule,
    WorkersModule,
    ReservationsModule,
    MovementsModule,
    ReconstructModule,
  ],
})
export class AppModule {}
