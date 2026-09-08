'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useKeeper, DEFAULT_KEEPERS } from '../context/keeper-context';
import { cn } from '../lib/utils';
import {
  Layers,
  History,
  BookOpen,
  UserCheck,
  ChevronDown,
  Wrench,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { activeKeeper, setActiveKeeper } = useKeeper();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navLinks = [
    { href: '/store', label: 'Store Inventory', icon: Layers },
    { href: '/reconstruct', label: 'Reconstruct ("As Of")', icon: History },
  ];

  return (
    <header className="border-b border-line bg-card sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/store" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center text-paper group-hover:bg-status-active transition-colors">
                <Wrench className="w-5 h-5 text-paper" />
              </div>
              <div>
                <span className="font-display font-bold text-lg text-ink tracking-tight flex items-center gap-1.5">
                  Equipment<span className="text-status-active">Ledger</span>
                </span>
                <span className="hidden sm:block text-[10px] font-mono text-ink-faint uppercase tracking-wider">
                  Site Store Operating Terminal
                </span>
              </div>
            </Link>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 ml-6 border-l border-line-soft pl-6">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  pathname === link.href ||
                  (link.href === '/store' && pathname?.startsWith('/assets/'));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-paper text-ink font-semibold shadow-inner border border-line'
                        : 'text-ink-soft hover:text-ink hover:bg-paper/50',
                    )}
                  >
                    <Icon className="w-4 h-4 text-ink-faint" />
                    {link.label}
                  </Link>
                );
              })}
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/docs`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-ink hover:bg-paper/50 transition-colors"
                title="OpenAPI Swagger documentation"
              >
                <BookOpen className="w-4 h-4 text-ink-faint" />
                <span>Swagger</span>
              </a>
            </nav>
          </div>

          {/* Keeper Selector at Hatch */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-paper text-ink text-sm font-mono hover:border-ink-soft transition-colors"
              title="Store keeper at the hatch (§8)"
            >
              <UserCheck className="w-4 h-4 text-status-active" />
              <span className="text-xs text-ink-faint uppercase font-bold hidden sm:inline">
                Hatch Keeper:
              </span>
              <span className="font-semibold text-ink">
                {activeKeeper || 'Select Keeper'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-ink-faint ml-1" />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-card border border-line rounded-xl shadow-lg z-20 py-2">
                  <div className="px-3 py-1.5 border-b border-line-soft">
                    <p className="text-[11px] font-mono uppercase text-ink-faint font-semibold">
                      Switch Active Keeper
                    </p>
                  </div>
                  {DEFAULT_KEEPERS.map((keeper) => (
                    <button
                      key={keeper}
                      onClick={() => {
                        setActiveKeeper(keeper);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3.5 py-2 text-sm flex items-center justify-between hover:bg-paper transition-colors',
                        activeKeeper === keeper
                          ? 'font-bold text-status-active bg-status-active-tint/30'
                          : 'text-ink-soft',
                      )}
                    >
                      <span>{keeper}</span>
                      {activeKeeper === keeper && (
                        <span className="w-2 h-2 rounded-full bg-status-active" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-line-soft mt-1 pt-1 px-3">
                    <Link
                      href="/"
                      onClick={() => setDropdownOpen(false)}
                      className="text-xs text-ink-faint hover:text-ink block py-1 font-mono"
                    >
                      Change or add keeper →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
