import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AssetDocument = HydratedDocument<Asset>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'assets' })
export class Asset {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true, index: true })
  kind: string;

  @Prop({ type: String, default: null })
  requiresCertification: string | null;

  // DENORMALISED CONCURRENCY GUARD ONLY (ADR-0001) - never read as the primary source of truth for history
  @Prop({ type: Types.ObjectId, ref: 'Worker', default: null, index: true })
  currentHolder: Types.ObjectId | null;

  // DENORMALISED CONCURRENCY GUARD ONLY (ADR-0002) - mirrors latest OUT_OF_SERVICE / BACK_IN_SERVICE movement
  @Prop({ type: Boolean, default: false, index: true })
  isOutOfService: boolean;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
