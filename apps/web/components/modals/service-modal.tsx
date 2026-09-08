'use client';

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useKeeper } from '../../context/keeper-context';
import { X, ShieldAlert, ShieldCheck, AlertCircle } from 'lucide-react';

interface ServiceModalProps {
  asset: any;
  action: 'OUT_OF_SERVICE' | 'BACK_IN_SERVICE';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ServiceModal({
  asset,
  action,
  isOpen,
  onClose,
  onSuccess,
}: ServiceModalProps) {
  const { activeKeeper } = useKeeper();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !asset) return null;

  const isOutOfService = action === 'OUT_OF_SERVICE';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      if (isOutOfService) {
        await api.outOfService(asset._id, {
          idempotencyKey,
          keeperName: activeKeeper || 'Default Keeper',
        });
      } else {
        await api.backInService(asset._id, {
          idempotencyKey,
          keeperName: activeKeeper || 'Default Keeper',
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/50">
          <div className="flex items-center gap-2.5">
            {isOutOfService ? (
              <ShieldAlert className="w-5 h-5 text-status-alert" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-status-done" />
            )}
            <h2 className="font-display font-bold text-lg text-ink">
              {isOutOfService ? 'Take Out of Service' : 'Restore to Service'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-paper text-ink-faint hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-status-alert-tint border border-red-300 text-status-alert text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-sm text-ink-soft">
            Are you sure you want to{' '}
            <strong className="text-ink">
              {isOutOfService ? 'take out of service' : 'restore to service'}
            </strong>{' '}
            asset <code className="font-mono">{asset.code}</code> ({asset.kind})?
          </p>

          {isOutOfService && (
            <div className="p-3 bg-status-start-tint/50 border border-amber-300 rounded-xl text-xs font-mono text-ink-soft">
              <strong>ADR-0002 Enforcement:</strong> Taking this in-store asset out of service will automatically cancel all future standing reservations with <code>actor: SYSTEM</code> audit entries.
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-ink-soft hover:bg-paper transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-paper transition-all shadow-sm ${
                isOutOfService
                  ? 'bg-status-alert hover:bg-red-700'
                  : 'bg-status-done hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {loading ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
