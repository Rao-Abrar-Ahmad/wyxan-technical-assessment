'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { AlertTriangle, Clock, CheckCircle2, ShieldAlert, User } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
  holderName?: string;
  className?: string;
}

export function StatusBadge({
  status,
  isOverdue,
  holderName,
  className,
}: StatusBadgeProps) {
  if (isOverdue) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wider bg-red-100 text-red-800 border border-red-300 animate-pulse',
          className,
        )}
        title="Held past reservation end window (§4)"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        OVERDUE ({holderName || 'Issued'})
      </span>
    );
  }

  switch (status?.toUpperCase()) {
    case 'IN_STORE':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wider bg-status-done-tint text-status-done border border-green-300',
            className,
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          IN STORE
        </span>
      );

    case 'ISSUED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wider bg-status-active-tint text-status-active border border-blue-300',
            className,
          )}
          title={holderName ? `Held by ${holderName}` : 'Issued'}
        >
          <User className="w-3.5 h-3.5" />
          ISSUED {holderName ? `· ${holderName}` : ''}
        </span>
      );

    case 'RESERVED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wider bg-status-start-tint text-status-start border border-amber-300',
            className,
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          RESERVED
        </span>
      );

    case 'OUT_OF_SERVICE':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wider bg-status-alert-tint text-status-alert border border-red-300',
            className,
          )}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          OUT OF SERVICE
        </span>
      );

    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-gray-100 text-gray-700 border border-gray-300',
            className,
          )}
        >
          {status}
        </span>
      );
  }
}
