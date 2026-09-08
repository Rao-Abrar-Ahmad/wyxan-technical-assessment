import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Asset, AssetDocument } from '../schemas/asset.schema';
import { Movement, MovementDocument } from '../schemas/movement.schema';
import { Reservation, ReservationDocument } from '../schemas/reservation.schema';
import { Worker, WorkerDocument } from '../schemas/worker.schema';

@Injectable()
export class ReconstructService {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
    @InjectModel(Movement.name) private movementModel: Model<MovementDocument>,
    @InjectModel(Reservation.name)
    private reservationModel: Model<ReservationDocument>,
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
  ) {}

  /**
   * Reconstructs the entire store as it stood at instant asOf (§6.6)
   * Computed live per request by folding all movements up to asOf,
   * honoring the latest correction for each movement.
   */
  async reconstructStore(asOfStr?: string): Promise<any> {
    const asOf = asOfStr ? new Date(asOfStr) : new Date();

    // 1. Fetch all assets and workers for lookup
    const [assets, workers, allReservations, rawMovements] = await Promise.all([
      this.assetModel.find().lean(),
      this.workerModel.find().lean(),
      this.reservationModel.find().lean(),
      this.movementModel.find().lean(),
    ]);

    const workersById = new Map<string, any>(
      workers.map((w) => [String(w._id), w]),
    );
    const reservationsById = new Map<string, any>(
      allReservations.map((r) => [String(r._id), r]),
    );

    // 2. Identify all corrections and resolve effective timestamps (§6.5)
    const correctionsByTarget = new Map<string, any[]>();
    for (const m of rawMovements) {
      if (m.type === 'CORRECTION' && m.correctsMovementId) {
        const targetId = String(m.correctsMovementId);
        const list = correctionsByTarget.get(targetId) || [];
        list.push(m);
        correctionsByTarget.set(targetId, list);
      }
    }

    // Assign effectiveOccurredAt
    const movementsWithEffective = rawMovements.map((m) => {
      const corrections = correctionsByTarget.get(String(m._id)) || [];
      // Sort corrections by recordedAt to find the latest correction
      corrections.sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
      const latestCorrection = corrections[0];
      const effectiveOccurredAt = latestCorrection
        ? new Date(latestCorrection.correctedOccurredAt)
        : new Date(m.occurredAt);

      return {
        ...m,
        isCorrected: corrections.length > 0,
        corrections,
        effectiveOccurredAt,
      };
    });

    // 3. Group movements by assetId
    const movementsByAsset = new Map<string, any[]>();
    for (const m of movementsWithEffective) {
      const aId = String(m.assetId);
      const list = movementsByAsset.get(aId) || [];
      list.push(m);
      movementsByAsset.set(aId, list);
    }

    // 4. Fold each asset's movements up to asOf
    const reconstructedAssets = assets.map((asset) => {
      const assetMovements = movementsByAsset.get(String(asset._id)) || [];

      // Filter to movements effective <= asOf
      const eligibleMovements = assetMovements
        .filter((m) => m.effectiveOccurredAt.getTime() <= asOf.getTime())
        .sort((a, b) => {
          const diff = a.effectiveOccurredAt.getTime() - b.effectiveOccurredAt.getTime();
          if (diff !== 0) return diff;
          return new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
        });

      let currentHolderId: any = null;
      let isOutOfService = false;
      let lastIssueReservationId: any = null;
      let lastMovement: any = null;

      for (const m of eligibleMovements) {
        lastMovement = m;
        switch (m.type) {
          case 'ISSUE':
            currentHolderId = m.workerId;
            lastIssueReservationId = m.reservationId;
            break;
          case 'RETURN':
            currentHolderId = null;
            lastIssueReservationId = null;
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

      // Check if overdue as of this instant:
      // Asset is held past the reservation windowEnd (§4)
      let isOverdue = false;
      let reservationWindowEnd: Date | null = null;
      if (currentHolderId && lastIssueReservationId) {
        const res = reservationsById.get(String(lastIssueReservationId));
        if (res && res.windowEnd) {
          reservationWindowEnd = new Date(res.windowEnd);
          if (reservationWindowEnd.getTime() < asOf.getTime()) {
            isOverdue = true;
          }
        }
      }

      // Check active reservation as of this instant
      const activeRes = allReservations.find((r) => {
        if (String(r.assetId) !== String(asset._id)) return false;
        const start = new Date(r.windowStart);
        const end = new Date(r.windowEnd);
        if (start.getTime() > asOf.getTime() || end.getTime() < asOf.getTime()) {
          return false;
        }
        // Ensure not cancelled before or as of this instant
        const cancelMovement = assetMovements.find(
          (m) =>
            m.type === 'CANCEL_RESERVATION' &&
            String(m.reservationId) === String(r._id) &&
            m.effectiveOccurredAt.getTime() <= asOf.getTime(),
        );
        return !cancelMovement;
      });

      let status = 'IN_STORE';
      if (isOutOfService) {
        status = 'OUT_OF_SERVICE';
      } else if (currentHolderId) {
        status = 'ISSUED';
      } else if (activeRes) {
        status = 'RESERVED';
      }

      const holderWorker = currentHolderId
        ? workersById.get(String(currentHolderId)) || { _id: currentHolderId }
        : null;

      return {
        _id: asset._id,
        code: asset.code,
        kind: asset.kind,
        requiresCertification: asset.requiresCertification,
        status,
        isOutOfService,
        currentHolder: holderWorker,
        isOverdue,
        reservationWindowEnd,
        activeReservation: activeRes
          ? {
              ...activeRes,
              worker: workersById.get(String(activeRes.workerId)),
            }
          : null,
        movementCountAsOf: eligibleMovements.length,
        lastMovementAsOf: lastMovement
          ? {
              type: lastMovement.type,
              occurredAt: lastMovement.occurredAt,
              effectiveOccurredAt: lastMovement.effectiveOccurredAt,
              actor: lastMovement.actor,
            }
          : null,
      };
    });

    return {
      asOf: asOf.toISOString(),
      totalAssets: reconstructedAssets.length,
      inStoreCount: reconstructedAssets.filter((a) => a.status === 'IN_STORE').length,
      issuedCount: reconstructedAssets.filter((a) => a.status === 'ISSUED').length,
      reservedCount: reconstructedAssets.filter((a) => a.status === 'RESERVED').length,
      outOfServiceCount: reconstructedAssets.filter((a) => a.status === 'OUT_OF_SERVICE').length,
      overdueCount: reconstructedAssets.filter((a) => a.isOverdue).length,
      assets: reconstructedAssets,
    };
  }
}
