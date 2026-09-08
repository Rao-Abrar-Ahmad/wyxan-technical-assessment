import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Asset, AssetSchema } from '../schemas/asset.schema';
import { Movement, MovementSchema } from '../schemas/movement.schema';
import { Reservation, ReservationSchema } from '../schemas/reservation.schema';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: Movement.name, schema: MovementSchema },
      { name: Reservation.name, schema: ReservationSchema },
    ]),
    MovementsModule,
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
