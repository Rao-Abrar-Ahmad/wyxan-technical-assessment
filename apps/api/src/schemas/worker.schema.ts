import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WorkerDocument = HydratedDocument<Worker>;

@Schema({ _id: false })
export class Certification {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  expiryDate: Date; // UTC midnight
}
export const CertificationSchema = SchemaFactory.createForClass(Certification);

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'workers' })
export class Worker {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ type: [CertificationSchema], default: [] })
  certifications: Certification[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
