import {
  Injectable,
  ConflictException,
  UnprocessableEntityException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Movement, MovementDocument } from '../schemas/movement.schema';
import { Asset, AssetDocument } from '../schemas/asset.schema';
import { Worker, WorkerDocument } from '../schemas/worker.schema';
import { Reservation, ReservationDocument } from '../schemas/reservation.schema';
import { DatabaseService } from '../database/database.service';
import { IssueAssetDto } from '../assets/dto/issue-asset.dto';
import { ReturnAssetDto } from '../assets/dto/return-asset.dto';
import { ReserveAssetDto } from '../assets/dto/reserve-asset.dto';
import { CorrectMovementDto } from './dto/correct-movement.dto';
import { CancelReservationDto } from '../reservations/dto/cancel-reservation.dto';
import { ActionIdempotencyDto } from '../assets/dto/action-idempotency.dto';

@Injectable()
export class MovementsService {
  private readonly logger = new Logger(MovementsService.name);

  constructor(
    @InjectModel(Movement.name) private movementModel: Model<MovementDocument>,
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
    @InjectModel(Reservation.name)
    private reservationModel: Model<ReservationDocument>,
    private databaseService: DatabaseService,
  ) {}

  /**
   * Helper to check idempotency.
   * If existing movement found:
   *   - If payload matches -> replay existing movement
   *   - If payload differs -> 409 Conflict
   */
  private async checkIdempotency(
    idempotencyKey: string,
    semanticPayload: Record<string, any>,
  ): Promise<MovementDocument | null> {
    const existing = await this.movementModel.findOne({ idempotencyKey });
    if (!existing) {
      return null;
    }

    // Verify semantic payload matches
    for (const [key, val] of Object.entries(semanticPayload)) {
      if (val === undefined || val === null) continue;
      const existingVal = (existing as any)[key];
      if (existingVal instanceof Types.ObjectId && val) {
        if (!existingVal.equals(new Types.ObjectId(val))) {
          throw new ConflictException(
            'This action was already submitted with different details.',
          );
        }
      } else if (existingVal instanceof Date && val) {
        if (existingVal.getTime() !== new Date(val).getTime()) {
          throw new ConflictException(
            'This action was already submitted with different details.',
          );
        }
      } else if (existingVal !== undefined && existingVal !== null) {
        if (String(existingVal) !== String(val)) {
          throw new ConflictException(
            'This action was already submitted with different details.',
          );
        }
      }
    }

    this.logger.log(
      `Idempotent replay for key ${idempotencyKey} (movement ${existing._id})`,
    );
    return existing;
  }

  /**
   * Record ISSUE movement with atomic guard flip (ADR-0001)
   */
  async recordIssue(
    assetIdStr: string,
    dto: IssueAssetDto,
  ): Promise<MovementDocument> {
    const assetId = new Types.ObjectId(assetIdStr);
    const workerId = new Types.ObjectId(dto.workerId);
    const reservationId = dto.reservationId
      ? new Types.ObjectId(dto.reservationId)
      : null;

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'ISSUE',
      assetId,
      workerId,
    });
    if (replay) return replay;

    return this.databaseService.runInTransaction(async (session) => {
      // 1. Atomic guard flip (ADR-0001)
      const updatedAsset = await this.assetModel.findOneAndUpdate(
        {
          _id: assetId,
          currentHolder: null,
          isOutOfService: false,
        },
        {
          $set: { currentHolder: workerId },
        },
        { session, new: false },
      );

      if (!updatedAsset) {
        // Find reason for refusal
        const currentAsset = await this.assetModel
          .findById(assetId)
          .session(session);
        if (!currentAsset) {
          throw new NotFoundException(`Asset ${assetIdStr} not found.`);
        }
        if (currentAsset.isOutOfService) {
          throw new UnprocessableEntityException('Asset is out of service.');
        }
        if (currentAsset.currentHolder) {
          throw new ConflictException(
            `Asset is already held by worker ${currentAsset.currentHolder}.`,
          );
        }
        throw new ConflictException('Concurrent conflict updating asset guard.');
      }

      // 2. Check certification requirement (§4: strict UTC calendar rule)
      if (updatedAsset.requiresCertification) {
        const worker = await this.workerModel
          .findById(workerId)
          .session(session);
        if (!worker) {
          throw new NotFoundException(`Worker ${dto.workerId} not found.`);
        }

        const requiredCertType = updatedAsset.requiresCertification;
        const matchingCert = worker.certifications.find(
          (c) => c.type.toLowerCase() === requiredCertType.toLowerCase(),
        );

        if (!matchingCert) {
          throw new UnprocessableEntityException(
            `Worker ${worker.name} does not hold required certification: ${requiredCertType}.`,
          );
        }

        // Calendar date check in UTC:
        // A certification is expired if expiryDate <= calendar date of issue attempt (UTC)
        // Valid only while expiryDate > today (UTC)
        const issueDate = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
        const issueCalendarDateUTC = new Date(
          Date.UTC(
            issueDate.getUTCFullYear(),
            issueDate.getUTCMonth(),
            issueDate.getUTCDate(),
          ),
        );

        const certExpiryDate = new Date(matchingCert.expiryDate);
        const certCalendarDateUTC = new Date(
          Date.UTC(
            certExpiryDate.getUTCFullYear(),
            certExpiryDate.getUTCMonth(),
            certExpiryDate.getUTCDate(),
          ),
        );

        if (certCalendarDateUTC.getTime() <= issueCalendarDateUTC.getTime()) {
          const expiryFormatted = certExpiryDate.toISOString().slice(0, 10);
          throw new UnprocessableEntityException(
            `Worker certification '${requiredCertType}' expired on ${expiryFormatted}. Expired certificates cannot be used to issue equipment.`,
          );
        }
      }

      // 3. If issued against a reservation, mark reservation FULFILLED
      if (reservationId) {
        await this.reservationModel.findByIdAndUpdate(
          reservationId,
          { $set: { status: 'FULFILLED' } },
          { session },
        );
      }

      // 4. Append Movement document
      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
      const movement = new this.movementModel({
        type: 'ISSUE',
        assetId,
        workerId,
        reservationId,
        occurredAt,
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
      });

      try {
        await movement.save({ session });
      } catch (err: any) {
        if (err.code === 11000) {
          // Unique index conflict on idempotencyKey
          const existing = await this.movementModel
            .findOne({ idempotencyKey: dto.idempotencyKey })
            .session(session);
          if (existing) return existing;
        }
        throw err;
      }

      return movement;
    });
  }

  /**
   * Record RETURN movement with condition & guard flip (ADR-0001, ADR-0002)
   */
  async recordReturn(
    assetIdStr: string,
    dto: ReturnAssetDto,
  ): Promise<MovementDocument> {
    const assetId = new Types.ObjectId(assetIdStr);

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'RETURN',
      assetId,
    });
    if (replay) return replay;

    return this.databaseService.runInTransaction(async (session) => {
      const asset = await this.assetModel.findById(assetId).session(session);
      if (!asset) {
        throw new NotFoundException(`Asset ${assetIdStr} not found.`);
      }
      if (!asset.currentHolder) {
        throw new ConflictException('Asset is not currently issued.');
      }

      const returnOccurredAt = dto.occurredAt
        ? new Date(dto.occurredAt)
        : new Date();

      // Backdating edge-case check (§10 Test 7):
      // Return cannot precede the corresponding issue's occurredAt
      const latestIssue = await this.movementModel
        .findOne({ assetId, type: 'ISSUE' })
        .sort({ occurredAt: -1, recordedAt: -1 })
        .session(session);

      if (latestIssue && returnOccurredAt.getTime() < latestIssue.occurredAt.getTime()) {
        throw new UnprocessableEntityException(
          `Return occurredAt (${returnOccurredAt.toISOString()}) cannot be before the corresponding issue occurredAt (${latestIssue.occurredAt.toISOString()}).`,
        );
      }

      const returningWorkerId = dto.workerId
        ? new Types.ObjectId(dto.workerId)
        : asset.currentHolder;

      const isDamaged = dto.condition === 'DAMAGED';

      // Atomic guard flip
      await this.assetModel.findOneAndUpdate(
        { _id: assetId, currentHolder: { $ne: null } },
        {
          $set: {
            currentHolder: null,
            ...(isDamaged ? { isOutOfService: true } : {}),
          },
        },
        { session },
      );

      // Append RETURN movement
      const returnMovement = new this.movementModel({
        type: 'RETURN',
        assetId,
        workerId: returningWorkerId,
        occurredAt: returnOccurredAt,
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
        condition: dto.condition,
      });

      await returnMovement.save({ session });

      // If damaged, ADR-0002 states return and out-of-service happen together
      if (isDamaged) {
        const outOfServiceMovement = new this.movementModel({
          type: 'OUT_OF_SERVICE',
          assetId,
          workerId: returningWorkerId,
          occurredAt: returnOccurredAt,
          recordedAt: new Date(),
          keeperName: dto.keeperName || 'Default Keeper',
          actor: 'KEEPER',
          idempotencyKey: `${dto.idempotencyKey}-oos`,
          meta: { reason: 'Returned in damaged condition' },
        });
        await outOfServiceMovement.save({ session });

        // Auto-cancel future standing reservations per ADR-0002
        await this.autoCancelStandingReservations(assetId, session);
      }

      return returnMovement;
    });
  }

  /**
   * Helper to auto-cancel standing reservations when an asset goes out of service (ADR-0002)
   */
  private async autoCancelStandingReservations(
    assetId: Types.ObjectId,
    session: ClientSession,
  ) {
    const now = new Date();
    const pendingReservations = await this.reservationModel
      .find({
        assetId,
        status: 'PENDING',
        windowEnd: { $gt: now },
      })
      .session(session);

    for (const res of pendingReservations) {
      res.status = 'CANCELLED';
      await res.save({ session });

      const cancelMovement = new this.movementModel({
        type: 'CANCEL_RESERVATION',
        assetId,
        workerId: res.workerId,
        reservationId: res._id,
        occurredAt: now,
        recordedAt: now,
        keeperName: 'System',
        actor: 'SYSTEM',
        idempotencyKey: `system-cancel-${res._id}-${Date.now()}`,
        meta: { reason: 'Asset marked out of service (ADR-0002)' },
      });
      await cancelMovement.save({ session });
    }
  }

  /**
   * Record RESERVE movement and reservation with overlap check (6.3)
   */
  async recordReserve(
    assetIdStr: string,
    dto: ReserveAssetDto,
  ): Promise<{ reservation: ReservationDocument; movement: MovementDocument }> {
    const assetId = new Types.ObjectId(assetIdStr);
    const workerId = new Types.ObjectId(dto.workerId);
    const windowStart = new Date(dto.windowStart);
    const windowEnd = new Date(dto.windowEnd);

    if (windowEnd.getTime() <= windowStart.getTime()) {
      throw new UnprocessableEntityException(
        'Window end must be strictly after window start.',
      );
    }

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'RESERVE',
      assetId,
      workerId,
    });
    if (replay && replay.reservationId) {
      const existingRes = await this.reservationModel.findById(
        replay.reservationId,
      );
      if (existingRes) {
        return { reservation: existingRes, movement: replay };
      }
    }

    return this.databaseService.runInTransaction(async (session) => {
      // Serialize reservation requests on this asset by touching the asset document inside the transaction
      const asset = await this.assetModel.findOneAndUpdate(
        { _id: assetId, isOutOfService: false },
        { $inc: { __v: 1 } },
        { session, new: true },
      );

      if (!asset) {
        const currentAsset = await this.assetModel.findById(assetId).session(session);
        if (!currentAsset) {
          throw new NotFoundException(`Asset ${assetIdStr} not found.`);
        }
        if (currentAsset.isOutOfService) {
          throw new UnprocessableEntityException(
            'Cannot reserve an asset that is out of service.',
          );
        }
        throw new ConflictException('Concurrent conflict updating asset reservation.');
      }

      // Overlap check (strict inequality: windowStart < existing.windowEnd AND windowEnd > existing.windowStart)
      const overlap = await this.reservationModel
        .findOne({
          assetId,
          status: { $ne: 'CANCELLED' },
          windowStart: { $lt: windowEnd },
          windowEnd: { $gt: windowStart },
        })
        .session(session);

      if (overlap) {
        throw new ConflictException(
          `Reservation overlaps with existing reservation ${overlap._id} (${overlap.windowStart.toISOString()} - ${overlap.windowEnd.toISOString()}).`,
        );
      }

      const reservation = new this.reservationModel({
        assetId,
        workerId,
        windowStart,
        windowEnd,
        status: 'PENDING',
        createdAt: new Date(),
      });
      await reservation.save({ session });

      const movement = new this.movementModel({
        type: 'RESERVE',
        assetId,
        workerId,
        reservationId: reservation._id,
        occurredAt: new Date(),
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
      });
      await movement.save({ session });

      return { reservation, movement };
    });
  }

  /**
   * Cancel an existing reservation
   */
  async recordCancelReservation(
    reservationIdStr: string,
    dto: CancelReservationDto,
  ): Promise<MovementDocument> {
    const reservationId = new Types.ObjectId(reservationIdStr);

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'CANCEL_RESERVATION',
      reservationId,
    });
    if (replay) return replay;

    return this.databaseService.runInTransaction(async (session) => {
      const reservation = await this.reservationModel
        .findById(reservationId)
        .session(session);
      if (!reservation) {
        throw new NotFoundException(
          `Reservation ${reservationIdStr} not found.`,
        );
      }
      if (reservation.status === 'CANCELLED') {
        throw new ConflictException('Reservation is already cancelled.');
      }

      reservation.status = 'CANCELLED';
      await reservation.save({ session });

      const movement = new this.movementModel({
        type: 'CANCEL_RESERVATION',
        assetId: reservation.assetId,
        workerId: reservation.workerId,
        reservationId: reservation._id,
        occurredAt: new Date(),
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
        meta: { reason: dto.reason || 'Keeper cancelled reservation' },
      });
      await movement.save({ session });

      return movement;
    });
  }

  /**
   * Mark an in-store asset out of service (ADR-0002)
   */
  async recordOutOfService(
    assetIdStr: string,
    dto: ActionIdempotencyDto,
  ): Promise<MovementDocument> {
    const assetId = new Types.ObjectId(assetIdStr);

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'OUT_OF_SERVICE',
      assetId,
    });
    if (replay) return replay;

    return this.databaseService.runInTransaction(async (session) => {
      const asset = await this.assetModel.findById(assetId).session(session);
      if (!asset) {
        throw new NotFoundException(`Asset ${assetIdStr} not found.`);
      }
      // ADR-0002: Cannot mark an asset out of service while currently issued
      if (asset.currentHolder !== null) {
        throw new UnprocessableEntityException(
          'Cannot mark an issued asset out of service directly. Damage discovered while held must be processed through the Return flow with DAMAGED condition (ADR-0002).',
        );
      }
      if (asset.isOutOfService) {
        throw new ConflictException('Asset is already out of service.');
      }

      asset.isOutOfService = true;
      await asset.save({ session });

      const movement = new this.movementModel({
        type: 'OUT_OF_SERVICE',
        assetId,
        workerId: null,
        occurredAt: new Date(),
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
      });
      await movement.save({ session });

      // Auto-cancel future standing reservations per ADR-0002
      await this.autoCancelStandingReservations(assetId, session);

      return movement;
    });
  }

  /**
   * Restore an out-of-service asset back to service
   */
  async recordBackInService(
    assetIdStr: string,
    dto: ActionIdempotencyDto,
  ): Promise<MovementDocument> {
    const assetId = new Types.ObjectId(assetIdStr);

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'BACK_IN_SERVICE',
      assetId,
    });
    if (replay) return replay;

    return this.databaseService.runInTransaction(async (session) => {
      const asset = await this.assetModel.findById(assetId).session(session);
      if (!asset) {
        throw new NotFoundException(`Asset ${assetIdStr} not found.`);
      }
      if (!asset.isOutOfService) {
        throw new ConflictException('Asset is already in service.');
      }
      if (asset.currentHolder !== null) {
        throw new ConflictException(
          'Asset cannot be brought back into service while held.',
        );
      }

      asset.isOutOfService = false;
      await asset.save({ session });

      const movement = new this.movementModel({
        type: 'BACK_IN_SERVICE',
        assetId,
        workerId: null,
        occurredAt: new Date(),
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
      });
      await movement.save({ session });

      return movement;
    });
  }

  /**
   * Record a CORRECTION movement (6.5)
   */
  async recordCorrection(
    movementIdStr: string,
    dto: CorrectMovementDto,
  ): Promise<MovementDocument> {
    const movementId = new Types.ObjectId(movementIdStr);

    const replay = await this.checkIdempotency(dto.idempotencyKey, {
      type: 'CORRECTION',
      correctsMovementId: movementId,
    });
    if (replay) return replay;

    return this.databaseService.runInTransaction(async (session) => {
      const targetMovement = await this.movementModel
        .findById(movementId)
        .session(session);
      if (!targetMovement) {
        throw new NotFoundException(
          `Movement ${movementIdStr} to correct not found.`,
        );
      }
      if (targetMovement.type === 'CORRECTION') {
        throw new UnprocessableEntityException(
          'Cannot correct a correction movement.',
        );
      }

      const correctedOccurredAt = new Date(dto.correctedOccurredAt);

      const correction = new this.movementModel({
        type: 'CORRECTION',
        assetId: targetMovement.assetId,
        workerId: targetMovement.workerId,
        reservationId: targetMovement.reservationId,
        occurredAt: targetMovement.occurredAt, // keeps original occurredAt on this record
        recordedAt: new Date(),
        keeperName: dto.keeperName || 'Default Keeper',
        actor: 'KEEPER',
        idempotencyKey: dto.idempotencyKey,
        correctsMovementId: targetMovement._id,
        correctedOccurredAt,
        correctionReason: dto.correctionReason,
      });

      await correction.save({ session });
      return correction;
    });
  }
}
