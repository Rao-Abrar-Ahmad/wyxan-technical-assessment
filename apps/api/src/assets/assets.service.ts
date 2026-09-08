import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Asset, AssetDocument } from '../schemas/asset.schema';
import { Movement, MovementDocument } from '../schemas/movement.schema';
import { Reservation, ReservationDocument } from '../schemas/reservation.schema';
import { MovementsService } from '../movements/movements.service';
import { IssueAssetDto } from './dto/issue-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { ReserveAssetDto } from './dto/reserve-asset.dto';
import { ActionIdempotencyDto } from './dto/action-idempotency.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
    @InjectModel(Movement.name) private movementModel: Model<MovementDocument>,
    @InjectModel(Reservation.name)
    private reservationModel: Model<ReservationDocument>,
    private movementsService: MovementsService,
  ) {}

  async findAll(kind?: string, status?: string): Promise<any[]> {
    const query: any = {};
    if (kind) {
      query.kind = kind;
    }

    const assets = await this.assetModel
      .find(query)
      .populate('currentHolder', 'name certifications')
      .sort({ code: 1 })
      .lean();

    const now = new Date();

    // Fetch active reservations to identify RESERVED status
    const activeReservations = await this.reservationModel.find({
      status: 'PENDING',
      windowStart: { $lte: now },
      windowEnd: { $gte: now },
    }).populate('workerId', 'name').lean();

    const activeResByAsset = new Map<string, any>();
    for (const res of activeReservations) {
      activeResByAsset.set(String(res.assetId), res);
    }

    // Identify overdue issued assets
    // Overdue applies ONLY if issued against a reservation whose windowEnd < now (§4)
    const enriched = await Promise.all(
      assets.map(async (asset) => {
        let computedStatus = 'IN_STORE';
        let isOverdue = false;
        let reservationInfo: any = null;

        if (asset.isOutOfService) {
          computedStatus = 'OUT_OF_SERVICE';
        } else if (asset.currentHolder) {
          computedStatus = 'ISSUED';

          // Check if issued against a reservation
          const latestIssue = await this.movementModel
            .findOne({ assetId: asset._id, type: 'ISSUE' })
            .sort({ occurredAt: -1, recordedAt: -1 })
            .populate('reservationId')
            .lean();

          if (latestIssue && latestIssue.reservationId) {
            const res = latestIssue.reservationId as any;
            if (res.windowEnd && new Date(res.windowEnd) < now) {
              isOverdue = true;
              reservationInfo = res;
            }
          }
        } else if (activeResByAsset.has(String(asset._id))) {
          computedStatus = 'RESERVED';
          reservationInfo = activeResByAsset.get(String(asset._id));
        }

        return {
          ...asset,
          status: computedStatus,
          isOverdue,
          activeReservation: reservationInfo,
        };
      }),
    );

    if (status) {
      return enriched.filter((a) => a.status.toUpperCase() === status.toUpperCase());
    }

    return enriched;
  }

  async findOne(id: string): Promise<any> {
    const asset = await this.assetModel
      .findById(id)
      .populate('currentHolder', 'name certifications')
      .lean();

    if (!asset) {
      throw new NotFoundException(`Asset ${id} not found.`);
    }

    const now = new Date();
    const upcomingReservations = await this.reservationModel
      .find({
        assetId: asset._id,
        status: 'PENDING',
        windowEnd: { $gt: now },
      })
      .populate('workerId', 'name')
      .sort({ windowStart: 1 })
      .lean();

    return {
      ...asset,
      upcomingReservations,
    };
  }

  async getHistory(id: string, asOfStr?: string): Promise<any> {
    const asset = await this.assetModel.findById(id).lean();
    if (!asset) {
      throw new NotFoundException(`Asset ${id} not found.`);
    }

    const assetId = new Types.ObjectId(id);

    // Fetch all movements for this asset
    const rawMovements = await this.movementModel
      .find({ assetId })
      .populate('workerId', 'name')
      .populate('correctsMovementId')
      .sort({ occurredAt: 1, recordedAt: 1 })
      .lean();

    // Map corrections to their original movements
    const correctionsByOriginal = new Map<string, any[]>();
    for (const m of rawMovements) {
      if (m.type === 'CORRECTION' && m.correctsMovementId) {
        const origId = String((m.correctsMovementId as any)._id || m.correctsMovementId);
        const list = correctionsByOriginal.get(origId) || [];
        list.push(m);
        correctionsByOriginal.set(origId, list);
      }
    }

    // Mark corrected movements visibly for history audit (§6.5)
    const history = rawMovements.map((m) => {
      const corrections = correctionsByOriginal.get(String(m._id)) || [];
      const latestCorrection = corrections[corrections.length - 1];
      return {
        ...m,
        isCorrected: corrections.length > 0,
        corrections,
        effectiveOccurredAt: latestCorrection
          ? latestCorrection.correctedOccurredAt
          : m.occurredAt,
      };
    });

    // If asOf provided, compute folded state up to asOf
    let derivedState = null;
    if (asOfStr) {
      const asOf = new Date(asOfStr);
      derivedState = this.foldAssetMovementsAsOf(history, asOf);
    }

    return {
      asset,
      history,
      derivedState,
    };
  }

  /**
   * Folds movements up to instant asOf, using effectiveOccurredAt
   */
  private foldAssetMovementsAsOf(movements: any[], asOf: Date) {
    // Filter movements whose effectiveOccurredAt <= asOf
    const eligible = movements
      .filter((m) => new Date(m.effectiveOccurredAt).getTime() <= asOf.getTime())
      .sort(
        (a, b) =>
          new Date(a.effectiveOccurredAt).getTime() -
          new Date(b.effectiveOccurredAt).getTime(),
      );

    let holder: any = null;
    let isOutOfService = false;
    let lastMovement: any = null;

    for (const m of eligible) {
      lastMovement = m;
      switch (m.type) {
        case 'ISSUE':
          holder = m.workerId;
          break;
        case 'RETURN':
          holder = null;
          if (m.condition === 'DAMAGED') {
            isOutOfService = true;
          }
          break;
        case 'OUT_OF_SERVICE':
          isOutOfService = true;
          break;
        case 'BACK_IN_SERVICE':
          isOutOfService = false;
          break;
      }
    }

    return {
      asOf: asOf.toISOString(),
      currentHolder: holder,
      isOutOfService,
      lastMovement,
      status: isOutOfService ? 'OUT_OF_SERVICE' : holder ? 'ISSUED' : 'IN_STORE',
    };
  }

  // Mutating endpoints delegating to MovementsService
  async issue(id: string, dto: IssueAssetDto) {
    return this.movementsService.recordIssue(id, dto);
  }

  async returnAsset(id: string, dto: ReturnAssetDto) {
    return this.movementsService.recordReturn(id, dto);
  }

  async reserve(id: string, dto: ReserveAssetDto) {
    return this.movementsService.recordReserve(id, dto);
  }

  async outOfService(id: string, dto: ActionIdempotencyDto) {
    return this.movementsService.recordOutOfService(id, dto);
  }

  async backInService(id: string, dto: ActionIdempotencyDto) {
    return this.movementsService.recordBackInService(id, dto);
  }
}
