'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { StatusBadge } from '../../../components/status-badge';
import { CorrectModal } from '../../../components/modals/correct-modal';
import { formatDateTimeUTC, formatDateOnly } from '../../../lib/utils';
import {
  ArrowLeft,
  Clock,
  Edit3,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  ShieldCheck,
  History,
  FileText,
  Calendar,
} from 'lucide-react';

export default function AssetDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Correction modal state
  const [correctingMovement, setCorrectingMovement] = useState<any | null>(null);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAssetHistory(id);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load asset history.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-6">
        <div className="h-6 bg-line-soft rounded w-32" />
        <div className="h-40 bg-card rounded-2xl border border-line" />
        <div className="h-64 bg-card rounded-2xl border border-line" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-4 bg-status-alert-tint text-status-alert rounded-2xl border border-red-300 max-w-md mx-auto">
          <p className="font-bold">Error loading asset history</p>
          <p className="text-xs mt-1">{error || 'Asset not found.'}</p>
        </div>
        <Link
          href="/store"
          className="inline-flex items-center gap-2 text-xs font-mono text-ink hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Store Inventory
        </Link>
      </div>
    );
  }

  const { asset, history } = data;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/store"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Store Inventory
        </Link>
      </div>

      {/* Asset Overview Card */}
      <div className="bg-card rounded-2xl border border-line p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-paper border border-line flex items-center justify-center font-mono font-bold text-lg text-ink">
              {asset.code.split('-')[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-2xl text-ink">
                  {asset.code}
                </h1>
                <StatusBadge status={asset.isOutOfService ? 'OUT_OF_SERVICE' : asset.currentHolder ? 'ISSUED' : 'IN_STORE'} />
              </div>
              <p className="text-xs font-mono text-ink-soft capitalize">
                Kind: <span className="text-ink font-semibold">{asset.kind}</span>
                {asset.requiresCertification && (
                  <span className="ml-3 inline-flex items-center gap-1 text-ink">
                    <ShieldCheck className="w-3.5 h-3.5 text-status-active" />
                    Req: {asset.requiresCertification}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={loadHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-paper text-xs font-mono text-ink-soft hover:text-ink transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Timeline</span>
          </button>
        </div>

        {/* Current State Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-1">
          <div>
            <span className="text-ink-faint block">Current Holder Guard</span>
            <span className="font-semibold text-ink">
              {asset.currentHolder ? (
                <span className="flex items-center gap-1 text-status-active">
                  <User className="w-3.5 h-3.5" />
                  {asset.currentHolder.name || asset.currentHolder}
                </span>
              ) : (
                'None (In Store)'
              )}
            </span>
          </div>

          <div>
            <span className="text-ink-faint block">Service Guard</span>
            <span className={`font-semibold ${asset.isOutOfService ? 'text-status-alert' : 'text-status-done'}`}>
              {asset.isOutOfService ? 'Out of Service' : 'In Service'}
            </span>
          </div>

          <div>
            <span className="text-ink-faint block">Total Movements</span>
            <span className="font-semibold text-ink">{history.length} logged facts</span>
          </div>

          <div>
            <span className="text-ink-faint block">Asset Initialized</span>
            <span className="text-ink-soft">{formatDateOnly(asset.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Full Movement History Timeline (§8 / §6.5) */}
      <div className="bg-card rounded-2xl border border-line p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-line-soft pb-3">
          <div>
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
              <History className="w-5 h-5 text-ink-faint" />
              Movement Audit Log (Append-Only)
            </h2>
            <p className="text-xs font-mono text-ink-soft">
              Authoritative event ledger. Past mistakes are amended via new correction movements, never deleted.
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-ink-faint font-mono py-8 text-center">
            No movements recorded for this asset yet.
          </p>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-2.5 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
            {history.map((m: any, idx: number) => {
              const isLateLogged =
                new Date(m.recordedAt).getTime() - new Date(m.occurredAt).getTime() >
                10 * 60 * 1000; // > 10 min difference

              const typeBadgeClass =
                m.type === 'ISSUE'
                  ? 'bg-status-active-tint text-status-active border-blue-300'
                  : m.type === 'RETURN'
                  ? 'bg-status-done-tint text-status-done border-green-300'
                  : m.type === 'RESERVE'
                  ? 'bg-status-start-tint text-status-start border-amber-300'
                  : m.type === 'CORRECTION'
                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-status-alert-tint text-status-alert border-red-300';

              return (
                <div key={m._id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 sm:-left-8 top-1.5 w-5 h-5 rounded-full bg-card border-2 border-ink flex items-center justify-center text-[9px] font-mono font-bold text-ink">
                    {idx + 1}
                  </div>

                  <div className="bg-paper p-4 rounded-xl border border-line space-y-3 transition-all hover:border-ink-soft">
                    {/* Top line: Movement Type + Badges + Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-wider border ${typeBadgeClass}`}
                        >
                          {m.type}
                        </span>

                        {/* Actor badge */}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-line text-ink-faint">
                          Actor: {m.actor}
                        </span>

                        {/* Condition if return */}
                        {m.condition && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              m.condition === 'DAMAGED'
                                ? 'bg-red-200 text-red-900'
                                : 'bg-green-200 text-green-900'
                            }`}
                          >
                            Condition: {m.condition}
                          </span>
                        )}

                        {/* Corrected indicator badge per §6.5 */}
                        {m.isCorrected && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 border border-purple-400 font-bold flex items-center gap-1">
                            <Edit3 className="w-3 h-3" />
                            CORRECTED
                          </span>
                        )}
                      </div>

                      {/* Action to correct this movement timestamp */}
                      {m.type !== 'CORRECTION' && (
                        <button
                          onClick={() => setCorrectingMovement(m)}
                          className="text-xs font-mono px-2.5 py-1 rounded-lg bg-card border border-line text-ink-soft hover:text-ink hover:border-ink-soft transition-colors flex items-center gap-1.5 shadow-xs"
                          title="Amend occurredAt timestamp (§6.5)"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-status-active" />
                          <span>Correct Timestamp</span>
                        </button>
                      )}
                    </div>

                    {/* Details row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-ink-faint">Occurred At (UTC): </span>
                        <span className="font-bold text-ink">
                          {formatDateTimeUTC(m.occurredAt)}
                        </span>
                      </div>

                      <div>
                        <span className="text-ink-faint">Recorded At (System): </span>
                        <span className="text-ink">
                          {formatDateTimeUTC(m.recordedAt)}
                        </span>
                        {isLateLogged && (
                          <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            Late entry
                          </span>
                        )}
                      </div>

                      {m.workerId && (
                        <div>
                          <span className="text-ink-faint">Worker: </span>
                          <span className="text-ink font-semibold">
                            {m.workerId.name || m.workerId}
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="text-ink-faint">Keeper: </span>
                        <span className="text-ink">{m.keeperName || '—'}</span>
                      </div>
                    </div>

                    {/* If CORRECTION movement: display details */}
                    {m.type === 'CORRECTION' && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs font-mono text-purple-900 space-y-1">
                        <p className="font-bold">
                          Correction Amendment on Movement #{String(m.correctsMovementId).slice(-6)}
                        </p>
                        <p>
                          Amended OccurredAt to:{' '}
                          <strong className="text-purple-950">
                            {formatDateTimeUTC(m.correctedOccurredAt)}
                          </strong>
                        </p>
                        <p className="italic text-purple-800">
                          Reason: &ldquo;{m.correctionReason}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* If this movement was corrected: show latest correction details */}
                    {m.isCorrected && m.corrections?.length > 0 && (
                      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-xs font-mono text-purple-900 space-y-1">
                        <div className="flex items-center gap-1 font-bold text-purple-950">
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Authoritative Timestamp Amended:</span>
                        </div>
                        <p>
                          Effective OccurredAt: <strong>{formatDateTimeUTC(m.effectiveOccurredAt)}</strong> (Original: {formatDateTimeUTC(m.occurredAt)})
                        </p>
                        <p className="italic text-purple-800">
                          Reason: &ldquo;{m.corrections[m.corrections.length - 1].correctionReason}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Metadata display if present */}
                    {m.meta && Object.keys(m.meta).length > 0 && (
                      <div className="text-[11px] font-mono text-ink-faint">
                        Meta: {JSON.stringify(m.meta)}
                      </div>
                    )}

                    <div className="text-[10px] font-mono text-ink-faint/70 flex items-center justify-between border-t border-line-soft pt-1.5">
                      <span>Movement ID: {m._id}</span>
                      <span>Idempotency Key: {m.idempotencyKey?.slice(0, 16)}...</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mount Correct Modal */}
      <CorrectModal
        movement={correctingMovement}
        isOpen={Boolean(correctingMovement)}
        onClose={() => setCorrectingMovement(null)}
        onSuccess={loadHistory}
      />
    </div>
  );
}
