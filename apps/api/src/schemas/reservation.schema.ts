import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReservationDocument = HydratedDocument<Reservation>;

export type ReservationStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'reservations' })
export class Reservation {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Asset', required: true, index: true })
  assetId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Worker', required: true, index: true })
  workerId: Types.ObjectId;

  @Prop({ required: true })
  windowStart: Date;

  @Prop({ required: true })
  windowEnd: Date;

  // Denormalised for query convenience, but movements log remains audit trail
  @Prop({
    type: String,
    enum: ['PENDING', 'FULFILLED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  })
  status: ReservationStatus;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);
ReservationSchema.index({ assetId: 1, windowStart: 1, windowEnd: 1 });
