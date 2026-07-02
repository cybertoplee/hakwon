'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-10 text-center">
      <h1 className="text-9xl font-black text-white mb-4">404</h1>
      <p className="text-2xl text-[#94A3B8] mb-8">
        페이지를 찾을 수 없습니다: <span className="text-white font-mono">{pathname}</span>
      </p>
      <div className="text-sm text-[#475569] mb-8">
        Base Path: {process.env.NEXT_PUBLIC_BASE_PATH || 'Not Set'}
      </div>
      <Link href="/">
        <button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-8 py-3 rounded-xl font-bold transition-all">
          홈으로 돌아가기
        </button>
      </Link>
    </div>
  );
}
