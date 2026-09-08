'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useKeeper } from '../../context/keeper-context';
import { formatDateOnly } from '../../lib/utils';
import { X, AlertCircle, CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react';

interface IssueModalProps {
  asset: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function IssueModal({
  asset,
  isOpen,
  onClose,
  onSuccess,
}: IssueModalProps) {
  const { activeKeeper } = useKeeper();
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedWorkerId('');
      setSelectedReservationId('');
      // Generate idempotency key once per user action-instance (§6.1 / §6.2)
      setIdempotencyKey(crypto.randomUUID());

      api.getWorkers().then(setWorkers).catch(console.error);

      if (asset?._id) {
        api.getReservations(asset._id, 'PENDING')
          .then(setReservations)
          .catch(console.error);
      }
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const selectedWorker = workers.find((w) => w._id === selectedWorkerId);

  // Check certification validity for selected worker
  let certStatus: 'VALID' | 'EXPIRED' | 'MISSING' | 'NOT_REQUIRED' = 'NOT_REQUIRED';
  let certDetails = '';

  if (asset.requiresCertification) {
    if (!selectedWorker) {
      certStatus = 'NOT_REQUIRED';
    } else {
      const matchingCert = selectedWorker.certifications?.find(
        (c: any) =>
          c.type.toLowerCase() === asset.requiresCertification.toLowerCase(),
      );
      if (!matchingCert) {
        certStatus = 'MISSING';
        certDetails = `Worker lacks '${asset.requiresCertification}' certification.`;
      } else {
        const today = new Date();
        const todayUTC = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
        );
        const certExpiry = new Date(matchingCert.expiryDate);
        const certUTC = new Date(
          Date.UTC(
            certExpiry.getUTCFullYear(),
            certExpiry.getUTCMonth(),
            certExpiry.getUTCDate(),
          ),
        );

        if (certUTC.getTime() <= todayUTC.getTime()) {
          certStatus = 'EXPIRED';
          certDetails = `Certification '${asset.requiresCertification}' expired on ${formatDateOnly(matchingCert.expiryDate)} (UTC).`;
        } else {
          certStatus = 'VALID';
          certDetails = `Valid '${asset.requiresCertification}' (expires ${formatDateOnly(matchingCert.expiryDate)}).`;
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) {
      setError('Please select a worker receiving the asset.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.issueAsset(asset._id, {
        workerId: selectedWorkerId,
        reservationId: selectedReservationId || undefined,
        idempotencyKey,
        keeperName: activeKeeper || 'Default Keeper',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to issue asset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/50">
          <div>
            <h2 className="font-display font-bold text-lg text-ink">
              Issue Asset — {asset.code}
            </h2>
            <p className="text-xs font-mono text-ink-soft">
              {asset.kind} {asset.requiresCertification ? `· Requires ${asset.requiresCertification}` : '· No cert required'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-paper text-ink-faint hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-status-alert-tint border border-red-300 text-status-alert text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Worker Selection */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
              Select Worker <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-status-active font-sans"
              required
            >
              <option value="">— Pick a worker from the list —</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} {w.certifications?.length > 0 ? `(${w.certifications.map((c: any) => c.type).join(', ')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Certification Status Warning */}
          {selectedWorkerId && asset.requiresCertification && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                certStatus === 'VALID'
                  ? 'bg-status-done-tint border-green-300 text-status-done'
                  : 'bg-status-alert-tint border-red-300 text-status-alert'
              }`}
            >
              {certStatus === 'VALID' ? (
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold">{certDetails}</p>
                {certStatus !== 'VALID' && (
                  <p className="text-[11px] mt-0.5 text-red-700">
                    Rule §4: Expired on the day of issue is refused. Backend will enforce this with 422.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Reservation match (optional) */}
          {reservations.length > 0 && (
            <div>
              <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
                Fulfill Standing Reservation (Optional)
              </label>
              <select
                value={selectedReservationId}
                onChange={(e) => setSelectedReservationId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-status-active"
              >
                <option value="">Walk-in issue (no reservation)</option>
                {reservations.map((r) => (
                  <option key={r._id} value={r._id}>
                    Reservation for {r.workerId?.name || 'Worker'} ({formatDateOnly(r.windowStart)} to {formatDateOnly(r.windowEnd)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Idempotency Info */}
          <div className="text-[11px] font-mono text-ink-faint bg-paper p-2.5 rounded-lg border border-line-soft">
            <span className="font-semibold text-ink">Idempotency Key:</span> {idempotencyKey.slice(0, 18)}... (replays safe)
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-ink-soft hover:bg-paper transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedWorkerId}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-ink text-paper hover:bg-status-active disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? 'Issuing...' : 'Confirm Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
