'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export const DEFAULT_KEEPERS = [
  'Alex Morgan',
  'Sam Taylor',
  'Jordan Lee',
  'Pat Casey',
];

interface KeeperContextType {
  activeKeeper: string | null;
  setActiveKeeper: (name: string) => void;
  clearKeeper: () => void;
}

const KeeperContext = createContext<KeeperContextType>({
  activeKeeper: null,
  setActiveKeeper: () => {},
  clearKeeper: () => {},
});

export function KeeperProvider({ children }: { children: React.ReactNode }) {
  const [activeKeeper, setActiveKeeperState] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('wyxan_active_keeper');
    if (saved) {
      setActiveKeeperState(saved);
    } else {
      // Default to first keeper for convenience if none chosen
      setActiveKeeperState(DEFAULT_KEEPERS[0]);
      sessionStorage.setItem('wyxan_active_keeper', DEFAULT_KEEPERS[0]);
    }
  }, []);

  const setActiveKeeper = (name: string) => {
    setActiveKeeperState(name);
    sessionStorage.setItem('wyxan_active_keeper', name);
  };

  const clearKeeper = () => {
    setActiveKeeperState(null);
    sessionStorage.removeItem('wyxan_active_keeper');
  };

  return (
    <KeeperContext.Provider
      value={{ activeKeeper, setActiveKeeper, clearKeeper }}
    >
      {children}
    </KeeperContext.Provider>
  );
}

export function useKeeper() {
  return useContext(KeeperContext);
}
