import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import WasteBot from '@/components/WasteBot';

export const metadata: Metadata = {
  title: 'Waste to Worth | Turn your waste into worth',
  description: 'India\'s Premier B2B Scrap, Waste & Circular Economy Marketplace. Sell scrap, buy raw materials, and track daily market rates.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <WasteBot />
          <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-sm mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">Waste<span className="text-emerald-500">2</span>Worth</span>
                <span className="text-slate-500">|</span>
                <span className="text-xs text-emerald-400">Turn your waste into worth</span>
              </div>
              <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} Waste to Worth Platform. All rights reserved.
              </p>
            </div>
            <div className="mx-auto mt-4 flex max-w-7xl justify-center gap-5 px-4 text-xs">
              <a href="/prohibited-items" className="hover:text-white">Prohibited items</a>
              <a href="/privacy" className="hover:text-white">Privacy</a>
              <a href="/terms" className="hover:text-white">Terms</a>
              <a href="/marketplace" className="hover:text-white">Marketplace</a>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
