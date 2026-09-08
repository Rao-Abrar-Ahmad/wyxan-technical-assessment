import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Asset, AssetSchema } from '../schemas/asset.schema';
import { Movement, MovementSchema } from '../schemas/movement.schema';
import { Reservation, ReservationSchema } from '../schemas/reservation.schema';
import { Worker, WorkerSchema } from '../schemas/worker.schema';
import { ReconstructController } from './reconstruct.controller';
import { ReconstructService } from './reconstruct.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: Movement.name, schema: MovementSchema },
      { name: Reservation.name, schema: ReservationSchema },
      { name: Worker.name, schema: WorkerSchema },
    ]),
  ],
  controllers: [ReconstructController],
  providers: [ReconstructService],
  exports: [ReconstructService],
})
export class ReconstructModule {}
