import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MovementDocument = HydratedDocument<Movement>;

export type MovementType =
  | 'ISSUE'
  | 'RETURN'
  | 'RESERVE'
  | 'CANCEL_RESERVATION'
  | 'OUT_OF_SERVICE'
  | 'BACK_IN_SERVICE'
  | 'CORRECTION';

export type ActorType = 'KEEPER' | 'SYSTEM';
export type ReturnCondition = 'OK' | 'DAMAGED';

@Schema({
  timestamps: false,
  collection: 'movements',
  // Strict: no updates or deletes permitted at application layer
})
export class Movement {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'ISSUE',
      'RETURN',
      'RESERVE',
      'CANCEL_RESERVATION',
      'OUT_OF_SERVICE',
      'BACK_IN_SERVICE',
      'CORRECTION',
    ],
    index: true,
  })
  type: MovementType;

  @Prop({ type: Types.ObjectId, ref: 'Asset', required: true, index: true })
  assetId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Worker', default: null, index: true })
  workerId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Reservation', default: null, index: true })
  reservationId: Types.ObjectId | null;

  @Prop({ required: true, index: true })
  occurredAt: Date; // when the event happened (keeper-entered, can be backdated)

  @Prop({ required: true, default: () => new Date(), index: true })
  recordedAt: Date; // when server wrote this document (system clock, never backdated)

  @Prop({ required: true, default: 'Default Keeper' })
  keeperName: string;

  @Prop({ required: true, enum: ['KEEPER', 'SYSTEM'], default: 'KEEPER' })
  actor: ActorType;

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey: string;

  // CORRECTION specific fields
  @Prop({ type: Types.ObjectId, ref: 'Movement', default: null })
  correctsMovementId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  correctedOccurredAt: Date | null;

  @Prop({ type: String, default: null })
  correctionReason: string | null;

  // RETURN specific fields
  @Prop({ type: String, enum: ['OK', 'DAMAGED', null], default: null })
  condition: ReturnCondition | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  meta: Record<string, unknown> | null;
}

export const MovementSchema = SchemaFactory.createForClass(Movement);
MovementSchema.index({ assetId: 1, occurredAt: 1 });
