import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reservation, ReservationDocument } from '../schemas/reservation.schema';
import { MovementsService } from '../movements/movements.service';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectModel(Reservation.name)
    private reservationModel: Model<ReservationDocument>,
    private movementsService: MovementsService,
  ) {}

  async findAll(assetId?: string, status?: string) {
    const query: any = {};
    if (assetId) {
      query.assetId = new Types.ObjectId(assetId);
    }
    if (status) {
      query.status = status.toUpperCase();
    }

    return this.reservationModel
      .find(query)
      .populate('assetId', 'code kind')
      .populate('workerId', 'name')
      .sort({ windowStart: 1 })
      .lean();
  }

  async cancel(id: string, dto: CancelReservationDto) {
    return this.movementsService.recordCancelReservation(id, dto);
  }
}
