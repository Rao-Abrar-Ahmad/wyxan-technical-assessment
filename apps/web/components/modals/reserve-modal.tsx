'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useKeeper } from '../../context/keeper-context';
import { formatDateOnly, formatDateTimeUTC } from '../../lib/utils';
import { X, Calendar, AlertCircle, Clock } from 'lucide-react';

interface ReserveModalProps {
  asset: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReserveModal({
  asset,
  isOpen,
  onClose,
  onSuccess,
}: ReserveModalProps) {
  const { activeKeeper } = useKeeper();
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [existingReservations, setExistingReservations] = useState<any[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedWorkerId('');
      setIdempotencyKey(crypto.randomUUID());

      // Default to tomorrow 08:00 to 17:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = `${tomorrow.toISOString().slice(0, 10)}T08:00`;
      const endStr = `${tomorrow.toISOString().slice(0, 10)}T17:00`;
      setWindowStart(startStr);
      setWindowEnd(endStr);

      api.getWorkers().then(setWorkers).catch(console.error);

      if (asset?._id) {
        api.getReservations(asset._id, 'PENDING')
          .then(setExistingReservations)
          .catch(console.error);
      }
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) {
      setError('Please select a worker for this reservation.');
      return;
    }
    if (!windowStart || !windowEnd) {
      setError('Please provide both window start and end times.');
      return;
    }
    if (new Date(windowEnd) <= new Date(windowStart)) {
      setError('Window end time must be strictly after window start time.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.reserveAsset(asset._id, {
        workerId: selectedWorkerId,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
        idempotencyKey,
        keeperName: activeKeeper || 'Default Keeper',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      // Overlap error surfaced inline per §8!
      setError(err.message || 'Failed to create reservation.');
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
              Reserve Asset — {asset.code}
            </h2>
            <p className="text-xs font-mono text-ink-soft">
              {asset.kind} · Invariant: No overlapping reservations (§6.3)
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
          {/* Inline conflict / refusal error banner */}
          {error && (
            <div className="p-4 rounded-xl bg-status-alert-tint border-2 border-status-alert text-status-alert text-sm flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Reservation Refused</p>
                <p className="text-xs mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Worker selection */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
              Worker Reserving <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-status-active"
              required
            >
              <option value="">— Pick a worker —</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Window start & end */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
                Window Start <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-2 focus:ring-status-active"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
                Window End <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-2 focus:ring-status-active"
                required
              />
            </div>
          </div>

          {/* Existing reservations view */}
          {existingReservations.length > 0 && (
            <div className="p-3 bg-paper rounded-xl border border-line-soft space-y-1.5">
              <span className="text-[11px] font-mono uppercase font-bold text-ink-soft flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Standing Pending Reservations:
              </span>
              <ul className="text-xs space-y-1 font-mono text-ink-soft pl-2">
                {existingReservations.map((r) => (
                  <li key={r._id} className="list-disc">
                    {r.workerId?.name}: {formatDateOnly(r.windowStart)} → {formatDateOnly(r.windowEnd)}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-ink text-paper hover:bg-status-active disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'Submitting...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
