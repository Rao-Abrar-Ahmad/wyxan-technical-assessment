'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useKeeper } from '../../context/keeper-context';
import { X, AlertTriangle, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ReturnModalProps {
  asset: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReturnModal({
  asset,
  isOpen,
  onClose,
  onSuccess,
}: ReturnModalProps) {
  const { activeKeeper } = useKeeper();
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [condition, setCondition] = useState<'OK' | 'DAMAGED'>('OK');
  const [occurredAt, setOccurredAt] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCondition('OK');
      setOccurredAt('');
      setIdempotencyKey(crypto.randomUUID());

      api.getWorkers().then((wList) => {
        setWorkers(wList);
        if (asset?.currentHolder?._id) {
          setSelectedWorkerId(asset.currentHolder._id);
        } else if (typeof asset?.currentHolder === 'string') {
          setSelectedWorkerId(asset.currentHolder);
        }
      });
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.returnAsset(asset._id, {
        workerId: selectedWorkerId || undefined,
        condition,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        idempotencyKey,
        keeperName: activeKeeper || 'Default Keeper',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to return asset.');
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
              Return Asset — {asset.code}
            </h2>
            <p className="text-xs font-mono text-ink-soft">
              {asset.kind} · Currently held by{' '}
              <span className="font-semibold text-ink">
                {asset.currentHolder?.name || 'Worker'}
              </span>
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

          {/* Worker who physically returned it */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
              Returned By (Can differ from holder)
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-status-active"
            >
              <option value="">— Same as current holder —</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Toggle: OK vs DAMAGED */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2">
              Asset Condition upon Return <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCondition('OK')}
                className={`py-3 px-4 rounded-xl border font-mono text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  condition === 'OK'
                    ? 'bg-status-done-tint border-green-400 text-status-done shadow-sm ring-2 ring-status-done/30'
                    : 'border-line bg-paper text-ink-soft hover:border-line-soft'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                OK (In Service)
              </button>
              <button
                type="button"
                onClick={() => setCondition('DAMAGED')}
                className={`py-3 px-4 rounded-xl border font-mono text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  condition === 'DAMAGED'
                    ? 'bg-status-alert-tint border-red-400 text-status-alert shadow-sm ring-2 ring-status-alert/30'
                    : 'border-line bg-paper text-ink-soft hover:border-line-soft'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                DAMAGED (Out of Service)
              </button>
            </div>
          </div>

          {/* ADR-0002 Damaged notice */}
          {condition === 'DAMAGED' && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">ADR-0002 Invariant Effect:</span>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Marking Damaged will atomically record both a RETURN and an OUT_OF_SERVICE movement, flip both guard fields, and auto-cancel any standing future reservations with SYSTEM-actor audit entries.
                </p>
              </div>
            </div>
          )}

          {/* Backdating / occurredAt picker */}
          <div>
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Backdate Return Time (Optional)</span>
              <span className="text-ink-faint font-normal">Defaults to now</span>
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm font-mono focus:outline-none focus:ring-2 focus:ring-status-active"
              />
            </div>
            <p className="text-[11px] text-ink-faint mt-1.5 font-mono">
              Late entry (§9): System records both when it happened and current server time.
            </p>
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
              {loading ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
