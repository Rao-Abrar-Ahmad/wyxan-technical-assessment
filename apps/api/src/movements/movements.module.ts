import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Movement, MovementSchema } from '../schemas/movement.schema';
import { Asset, AssetSchema } from '../schemas/asset.schema';
import { Worker, WorkerSchema } from '../schemas/worker.schema';
import { Reservation, ReservationSchema } from '../schemas/reservation.schema';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Movement.name, schema: MovementSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: Worker.name, schema: WorkerSchema },
      { name: Reservation.name, schema: ReservationSchema },
    ]),
  ],
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}
