'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { StatusBadge } from '../../components/status-badge';
import { IssueModal } from '../../components/modals/issue-modal';
import { ReturnModal } from '../../components/modals/return-modal';
import { ReserveModal } from '../../components/modals/reserve-modal';
import { ServiceModal } from '../../components/modals/service-modal';
import {
  Search,
  Filter,
  RefreshCw,
  Clock,
  History,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

export default function StoreInventoryPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals state
  const [activeAsset, setActiveAsset] = useState<any | null>(null);
  const [modalType, setModalType] = useState<
    'ISSUE' | 'RETURN' | 'RESERVE' | 'SERVICE' | null
  >(null);
  const [serviceAction, setServiceAction] = useState<
    'OUT_OF_SERVICE' | 'BACK_IN_SERVICE'
  >('OUT_OF_SERVICE');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAssets(selectedKind, selectedStatus);
      setAssets(data);
    } catch (err: any) {
      setError(
        err.message ||
          'Failed to load assets. Is the backend API running on port 4000?',
      );
    } finally {
      setLoading(false);
    }
  }, [selectedKind, selectedStatus]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Client-side search filtering
  const filteredAssets = assets.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.code.toLowerCase().includes(q) ||
      a.kind.toLowerCase().includes(q) ||
      (a.currentHolder?.name && a.currentHolder.name.toLowerCase().includes(q))
    );
  });

  const kinds = [
    'ALL',
    'harness',
    'gas-detector',
    'drill',
    'ladder',
    'generator',
    'radio',
    'grinder',
    'tripod',
  ];

  const statuses = [
    'ALL',
    'IN_STORE',
    'ISSUED',
    'RESERVED',
    'OUT_OF_SERVICE',
  ];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-faint uppercase tracking-wider">
              Store Control
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-paper border border-line-soft font-mono font-bold text-ink">
              {filteredAssets.length} assets
            </span>
          </div>
          <h1 className="font-display font-bold text-2xl text-ink tracking-tight">
            Equipment Store Inventory
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAssets()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-card text-xs font-mono text-ink-soft hover:text-ink hover:border-ink-soft transition-all shadow-sm"
            title="Reload store status"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-status-alert-tint border border-red-300 text-status-alert text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Connection Refusal</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-card p-4 rounded-2xl border border-line shadow-sm">
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink-faint" />
          <input
            type="text"
            placeholder="Search by code (HARN-001), kind, or worker name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs font-mono rounded-xl border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-status-active"
          />
        </div>

        {/* Kind filter */}
        <div>
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-status-active capitalize"
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                Kind: {k}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-status-active"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                Status: {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dense Assets Table */}
      <div className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-[11px] font-mono text-ink-faint uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Asset Code</th>
                <th className="py-3 px-4 font-bold">Kind</th>
                <th className="py-3 px-4 font-bold">Certification Req</th>
                <th className="py-3 px-4 font-bold">Operational Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-xs">
              {loading ? (
                // Skeleton loading state per §8
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-line-soft rounded w-20" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-line-soft rounded w-24" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-line-soft rounded w-28" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 bg-line-soft rounded-full w-32" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-6 bg-line-soft rounded w-24 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink-faint">
                    <p className="font-mono text-sm">No matching assets found.</p>
                    <p className="text-xs mt-1">Try broadening your search or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const isIssued = asset.status === 'ISSUED';
                  const isOutOfService = asset.status === 'OUT_OF_SERVICE';
                  const isInStore = asset.status === 'IN_STORE' || asset.status === 'RESERVED';

                  return (
                    <tr
                      key={asset._id}
                      className="hover:bg-paper/40 transition-colors group"
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-bold text-sm text-ink">
                        <Link
                          href={`/assets/${asset._id}`}
                          className="hover:text-status-active hover:underline flex items-center gap-1.5"
                          title="View asset history & corrections"
                        >
                          {asset.code}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-status-active transition-opacity" />
                        </Link>
                      </td>

                      {/* Kind */}
                      <td className="py-3 px-4 capitalize font-medium text-ink-soft">
                        {asset.kind}
                      </td>

                      {/* Required Cert */}
                      <td className="py-3 px-4 font-mono">
                        {asset.requiresCertification ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-paper border border-line text-ink font-semibold">
                            <ShieldCheck className="w-3 h-3 text-status-active" />
                            {asset.requiresCertification}
                          </span>
                        ) : (
                          <span className="text-ink-faint text-[11px]">None</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={asset.status}
                          isOverdue={asset.isOverdue}
                          holderName={asset.currentHolder?.name}
                        />
                      </td>

                      {/* Row actions per §8 */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Issue Button */}
                          {isInStore && !isOutOfService && (
                            <button
                              onClick={() => {
                                setActiveAsset(asset);
                                setModalType('ISSUE');
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-ink text-paper hover:bg-status-active transition-colors shadow-xs"
                            >
                              Issue
                            </button>
                          )}

                          {/* Return Button */}
                          {isIssued && (
                            <button
                              onClick={() => {
                                setActiveAsset(asset);
                                setModalType('RETURN');
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-status-active-tint text-status-active border border-blue-300 hover:bg-blue-100 transition-colors"
                            >
                              Return
                            </button>
                          )}

                          {/* Reserve Button */}
                          {!isOutOfService && (
                            <button
                              onClick={() => {
                                setActiveAsset(asset);
                                setModalType('RESERVE');
                              }}
                              className="px-2 py-1 rounded-lg text-xs font-mono font-medium text-ink-soft hover:text-ink hover:bg-paper border border-transparent hover:border-line transition-all"
                            >
                              Reserve
                            </button>
                          )}

                          {/* Out of service / Back in service */}
                          {isOutOfService ? (
                            <button
                              onClick={() => {
                                setActiveAsset(asset);
                                setServiceAction('BACK_IN_SERVICE');
                                setModalType('SERVICE');
                              }}
                              className="px-2 py-1 rounded-lg text-xs font-mono font-medium text-status-done hover:bg-status-done-tint transition-colors"
                            >
                              Restore
                            </button>
                          ) : (
                            !isIssued && (
                              <button
                                onClick={() => {
                                  setActiveAsset(asset);
                                  setServiceAction('OUT_OF_SERVICE');
                                  setModalType('SERVICE');
                                }}
                                className="px-2 py-1 rounded-lg text-xs font-mono font-medium text-ink-faint hover:text-status-alert hover:bg-status-alert-tint/50 transition-colors"
                                title="Mark out of service (ADR-0002)"
                              >
                                Take OOS
                              </button>
                            )
                          )}

                          {/* History View Link */}
                          <Link
                            href={`/assets/${asset._id}`}
                            className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-paper transition-colors"
                            title="View audit history & corrections"
                          >
                            <History className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals mount */}
      <IssueModal
        asset={activeAsset}
        isOpen={modalType === 'ISSUE'}
        onClose={() => setModalType(null)}
        onSuccess={loadAssets}
      />

      <ReturnModal
        asset={activeAsset}
        isOpen={modalType === 'RETURN'}
        onClose={() => setModalType(null)}
        onSuccess={loadAssets}
      />

      <ReserveModal
        asset={activeAsset}
        isOpen={modalType === 'RESERVE'}
        onClose={() => setModalType(null)}
        onSuccess={loadAssets}
      />

      <ServiceModal
        asset={activeAsset}
        action={serviceAction}
        isOpen={modalType === 'SERVICE'}
        onClose={() => setModalType(null)}
        onSuccess={loadAssets}
      />
    </div>
  );
}
