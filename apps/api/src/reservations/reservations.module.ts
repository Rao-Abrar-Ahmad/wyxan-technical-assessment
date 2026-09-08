import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reservation, ReservationSchema } from '../schemas/reservation.schema';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
    ]),
    MovementsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
