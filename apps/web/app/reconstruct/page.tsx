'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTimeUTC } from '../../lib/utils';
import {
  History,
  Clock,
  Calendar,
  Search,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function ReconstructStorePage() {
  // Target asOf datetime string (ISO or local)
  const [asOfInput, setAsOfInput] = useState<string>('');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Initialize with current time
  useEffect(() => {
    const now = new Date();
    setAsOfInput(now.toISOString().slice(0, 16));
  }, []);

  const handleReconstruct = useCallback(
    async (overrideTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const timeToQuery = overrideTime || asOfInput;
        const isoString = timeToQuery ? new Date(timeToQuery).toISOString() : undefined;
        const res = await api.reconstructStore(isoString);
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to reconstruct store.');
      } finally {
        setLoading(false);
      }
    },
    [asOfInput],
  );

  useEffect(() => {
    if (asOfInput) {
      handleReconstruct();
    }
  }, [asOfInput, handleReconstruct]);

  // Quick Preset Handlers
  const applyPreset = (hoursOffset: number) => {
    const d = new Date(Date.now() - hoursOffset * 3600 * 1000);
    const val = d.toISOString().slice(0, 16);
    setAsOfInput(val);
    handleReconstruct(val);
  };

  const filteredAssets =
    data?.assets?.filter((a: any) => {
      const matchesSearch =
        !searchQuery ||
        a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.kind.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.currentHolder?.name &&
          a.currentHolder.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || a.status.toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    }) || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-faint uppercase tracking-wider">
            Point-in-Time Reconstruction (§6.6)
          </span>
        </div>
        <h1 className="font-display font-bold text-2xl text-ink tracking-tight flex items-center gap-2.5">
          <History className="w-6 h-6 text-status-active" />
          Store State Reconstruction
        </h1>
        <p className="text-xs text-ink-soft max-w-2xl mt-1 leading-relaxed">
          &ldquo;What did the whole store look like at any past instant?&rdquo; Answered by live folding the append-only ledger up to that instant, reading authoritative corrections.
        </p>
      </div>

      {/* Instant Selector Controls Card */}
      <div className="bg-card rounded-2xl border border-line p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Datetime Input */}
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-mono font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-status-active" />
              Reconstruct Store As Of (Target Instant)
            </label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={asOfInput}
                onChange={(e) => setAsOfInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-line bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-2 focus:ring-status-active"
              />
              <button
                onClick={() => handleReconstruct()}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-ink text-paper hover:bg-status-active transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Fold</span>
              </button>
            </div>
            {data?.asOf && (
              <p className="text-[11px] font-mono text-ink-faint mt-1">
                Authoritative UTC instant: <strong>{formatDateTimeUTC(data.asOf)}</strong>
              </p>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase font-bold text-ink-faint block">
              Quick Timelines:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => applyPreset(0)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-line bg-paper hover:bg-card text-ink-soft hover:text-ink transition-colors"
              >
                Now
              </button>
              <button
                onClick={() => applyPreset(1)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-line bg-paper hover:bg-card text-ink-soft hover:text-ink transition-colors"
              >
                1h ago
              </button>
              <button
                onClick={() => applyPreset(24)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-line bg-paper hover:bg-card text-ink-soft hover:text-ink transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={() => applyPreset(7 * 24)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-line bg-paper hover:bg-card text-ink-soft hover:text-ink transition-colors"
              >
                7d ago
              </button>
              <button
                onClick={() => applyPreset(25 * 24)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-line bg-paper hover:bg-card text-ink-soft hover:text-ink transition-colors"
              >
                25d ago
              </button>
            </div>
          </div>
        </div>

        {/* Reconstructed State Counts Banner */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3 border-t border-line-soft text-center font-mono">
            <div className="bg-paper p-2.5 rounded-xl border border-line">
              <span className="text-[10px] text-ink-faint block uppercase">Total Assets</span>
              <span className="text-base font-bold text-ink">{data.totalAssets}</span>
            </div>
            <div className="bg-status-done-tint/50 p-2.5 rounded-xl border border-green-200">
              <span className="text-[10px] text-status-done block uppercase">In Store</span>
              <span className="text-base font-bold text-status-done">{data.inStoreCount}</span>
            </div>
            <div className="bg-status-active-tint/50 p-2.5 rounded-xl border border-blue-200">
              <span className="text-[10px] text-status-active block uppercase">Issued</span>
              <span className="text-base font-bold text-status-active">{data.issuedCount}</span>
            </div>
            <div className="bg-status-start-tint/50 p-2.5 rounded-xl border border-amber-200">
              <span className="text-[10px] text-status-start block uppercase">Reserved</span>
              <span className="text-base font-bold text-status-start">{data.reservedCount}</span>
            </div>
            <div className="bg-status-alert-tint/50 p-2.5 rounded-xl border border-red-200">
              <span className="text-[10px] text-status-alert block uppercase">Out of Service</span>
              <span className="text-base font-bold text-status-alert">{data.outOfServiceCount}</span>
            </div>
            <div className="bg-red-100 p-2.5 rounded-xl border border-red-300">
              <span className="text-[10px] text-red-800 block uppercase">Overdue</span>
              <span className="text-base font-bold text-red-800">{data.overdueCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-status-alert-tint border border-red-300 text-status-alert text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Reconstruction Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Table Search & Status Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink-faint" />
          <input
            type="text"
            placeholder="Search reconstructed store by asset code or holder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs font-mono rounded-xl border border-line bg-card text-ink focus:outline-none focus:ring-2 focus:ring-status-active"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs font-mono rounded-xl border border-line bg-card text-ink focus:outline-none focus:ring-2 focus:ring-status-active self-stretch sm:self-auto"
        >
          <option value="ALL">Status: ALL</option>
          <option value="IN_STORE">Status: IN STORE</option>
          <option value="ISSUED">Status: ISSUED</option>
          <option value="RESERVED">Status: RESERVED</option>
          <option value="OUT_OF_SERVICE">Status: OUT OF SERVICE</option>
        </select>
      </div>

      {/* Reconstructed Table */}
      <div className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-[11px] font-mono text-ink-faint uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Asset Code</th>
                <th className="py-3 px-4 font-bold">Kind</th>
                <th className="py-3 px-4 font-bold">Reconstructed Status</th>
                <th className="py-3 px-4 font-bold">Holder As Of Instant</th>
                <th className="py-3 px-4 font-bold">Fold Details</th>
                <th className="py-3 px-4 font-bold text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-xs">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 bg-line-soft rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-line-soft rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-5 bg-line-soft rounded-full w-28" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-line-soft rounded w-32" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-line-soft rounded w-28" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 bg-line-soft rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-faint font-mono">
                    No matching assets in this reconstruction view.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset: any) => (
                  <tr key={asset._id} className="hover:bg-paper/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sm text-ink">
                      <Link
                        href={`/assets/${asset._id}?asOf=${encodeURIComponent(asOfInput)}`}
                        className="hover:text-status-active hover:underline"
                      >
                        {asset.code}
                      </Link>
                    </td>

                    <td className="py-3 px-4 capitalize font-medium text-ink-soft">
                      {asset.kind}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge
                        status={asset.status}
                        isOverdue={asset.isOverdue}
                        holderName={asset.currentHolder?.name}
                      />
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {asset.currentHolder ? (
                        <span className="text-ink font-semibold">
                          {asset.currentHolder.name || 'Worker'}
                        </span>
                      ) : asset.activeReservation ? (
                        <span className="text-status-start text-[11px]">
                          Reserved by {asset.activeReservation.worker?.name || 'Worker'}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-ink-faint text-[11px]">
                      {asset.movementCountAsOf} movements folded
                      {asset.lastMovementAsOf && (
                        <span className="block text-[10px]">
                          Last: {asset.lastMovementAsOf.type} ({formatDateTimeUTC(asset.lastMovementAsOf.effectiveOccurredAt).slice(5, 16)})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      <Link
                        href={`/assets/${asset._id}`}
                        className="text-status-active hover:underline text-xs"
                      >
                        Timeline →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
