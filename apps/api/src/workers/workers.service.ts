import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Worker, WorkerDocument } from '../schemas/worker.schema';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
  ) {}

  async findAll(): Promise<WorkerDocument[]> {
    return this.workerModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<WorkerDocument | null> {
    return this.workerModel.findById(id).exec();
  }
}
