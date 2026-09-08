import './globals.css';
import type { Metadata } from 'next';
import { KeeperProvider } from '../context/keeper-context';
import { Navbar } from '../components/navbar';

export const metadata: Metadata = {
  title: 'Equipment Ledger — Site Store Operating Terminal',
  description:
    'Append-only event ledger for construction physical assets with mutual exclusion guards, strict certification gating, and live historical reconstruction.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-paper text-ink selection:bg-status-start-tint">
        <KeeperProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <footer className="border-t border-line bg-card py-6 text-center text-xs font-mono text-ink-faint">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <strong>Equipment Ledger</strong> · Append-only ledger with denormalised concurrency guards (ADR-0001, ADR-0002)
              </div>
              <div className="text-ink-soft">
                All timestamps in UTC · Strict idempotency enforced
              </div>
            </div>
          </footer>
        </KeeperProvider>
      </body>
    </html>
  );
}
