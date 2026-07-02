import React from 'react';
import MobileBottomNav from '@/components/MobileBottomNav';

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe">
      <main className="flex-1 pb-16 overflow-x-hidden">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
