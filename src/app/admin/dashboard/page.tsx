'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
      <div className="animate-pulse text-slate-400 font-black">Redirecting to Dashboard...</div>
    </div>
  );
}
