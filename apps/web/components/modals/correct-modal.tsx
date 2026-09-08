'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useKeeper } from '../../context/keeper-context';
import { formatDateTimeUTC } from '../../lib/utils';
import { X, Edit3, AlertCircle } from 'lucide-react';

interface CorrectModalProps {
  movement: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CorrectModal({
  movement,
  isOpen,
  onClose,
  onSuccess,
}: CorrectModalProps) {
  const { activeKeeper } = useKeeper();
  const [correctedOccurredAt, setCorrectedOccurredAt] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && movement) {
      setError(null);
      setCorrectionReason('');
      setIdempotencyKey(crypto.randomUUID());

      // Pre-populate with current occurredAt in datetime-local format
      const date = new Date(movement.occurredAt);
      const iso = date.toISOString().slice(0, 16);
      setCorrectedOccurredAt(iso);
    }
  }, [isOpen, movement]);

  if (!isOpen || !movement) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctedOccurredAt) {
      setError('Please provide the corrected occurredAt timestamp.');
      return;
    }
    if (!correctionReason.trim()) {
      setError('Correction reason is mandatory (§6.5).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.correctMovement(movement._id, {
        correctedOccurredAt: new Date(correctedOccurredAt).toISOString(),
        correctionReason: correctionReason.trim(),
        idempotencyKey,
        keeperName: activeKeeper || 'Default Keeper',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-status-active-tint text-status-active flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-ink">
                Correct Movement Timestamp
              </h2>
              <p className="text-xs font-mono text-ink-soft">
                Movement ID: {movement._id} · Type: {movement.type}
              </p>
            </div>
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

          {/* Current vs Corrected Display */}
          <div className="p-3.5 bg-paper rounded-xl border border-line space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-faint">Recorded Movement Type:</span>
              <span className="font-bold text-ink">{movement.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-faint">Original Occurred At:</span>
              <span className="font-bold text-ink">{formatDateTimeUTC(movement.occurredAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-faint">Logged By Keeper:</span>
              <span className="text-ink">{movement.keeperName || '—'}</span>
            </div>
          </div>

          {/* Scope Discipline Note */}
          <div className="text-[11px] font-mono text-ink-soft bg-status-start-tint/40 p-3 rounded-xl border border-amber-200">
            <strong>Scope Constraint (§6.5):</strong> A correction amends the <code>occurredAt</code> timestamp only. Correcting who held what is not supported. The original movement remains visible in audit history.
          </div>

          {/* New OccurredAt */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
              Corrected Occurred At (UTC) <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={correctedOccurredAt}
              onChange={(e) => setCorrectedOccurredAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm font-mono focus:outline-none focus:ring-2 focus:ring-status-active"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
              Reason for Correction <span className="text-red-500">*</span>
            </label>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              rows={3}
              placeholder="e.g. Worker picked up gear at 09:00, keeper was delayed logging until 11:40"
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-status-active font-sans"
              required
            />
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
              disabled={loading}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-ink text-paper hover:bg-status-active disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'Submitting...' : 'Record Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
