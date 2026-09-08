'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useKeeper, DEFAULT_KEEPERS } from '../context/keeper-context';
import { UserCheck, ArrowRight, Shield, Wrench } from 'lucide-react';

export default function KeeperSelectPage() {
  const router = useRouter();
  const { activeKeeper, setActiveKeeper } = useKeeper();
  const [customName, setCustomName] = useState('');

  const handleSelect = (name: string) => {
    setActiveKeeper(name);
    router.push('/store');
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customName.trim()) {
      setActiveKeeper(customName.trim());
      router.push('/store');
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-10">
      <div className="bg-card w-full max-w-md rounded-2xl border border-line shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-ink text-paper flex items-center justify-center mx-auto mb-3 shadow-md">
            <Wrench className="w-6 h-6 text-paper" />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-faint">
            Hatch Session Identification
          </p>
          <h1 className="font-display font-bold text-2xl text-ink">
            Who is at the hatch?
          </h1>
          <p className="text-xs text-ink-soft max-w-xs mx-auto leading-relaxed">
            Per the brief: no auth or passwords. Select the store keeper recording movements for this session.
          </p>
        </div>

        {/* Keeper List */}
        <div className="space-y-2.5">
          {DEFAULT_KEEPERS.map((keeper) => {
            const isSelected = activeKeeper === keeper;
            return (
              <button
                key={keeper}
                onClick={() => handleSelect(keeper)}
                className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all group ${
                  isSelected
                    ? 'border-status-active bg-status-active-tint/50 text-ink shadow-sm ring-1 ring-status-active'
                    : 'border-line bg-paper hover:border-ink-soft text-ink-soft hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-status-active text-paper'
                        : 'bg-card text-ink-faint group-hover:text-ink'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm block text-ink">
                      {keeper}
                    </span>
                    <span className="text-[11px] font-mono text-ink-faint">
                      Site Store Keeper
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-faint group-hover:translate-x-0.5 group-hover:text-ink transition-all" />
              </button>
            );
          })}
        </div>

        {/* Write-in keeper option */}
        <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-line-soft">
          <label className="block text-[11px] font-mono uppercase font-bold text-ink-faint mb-1.5">
            Or enter another name:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Alex Morgan"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-status-active font-mono"
            />
            <button
              type="submit"
              disabled={!customName.trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-ink text-paper hover:bg-status-active disabled:opacity-40 transition-colors font-mono"
            >
              Continue
            </button>
          </div>
        </form>

        <div className="text-[11px] font-mono text-center text-ink-faint bg-paper p-3 rounded-xl border border-line-soft">
          Active keeper is persisted in <code>sessionStorage</code> and attached to every ledger movement.
        </div>
      </div>
    </div>
  );
}
