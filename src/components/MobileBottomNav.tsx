'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, ClipboardList, Settings, ScanFace } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const tabs = [
    { name: '출결 기록', href: '/m/attendance', icon: ClipboardList },
    { name: '관원 목록', href: '/m/students', icon: Users },
    { name: '출석 모니터', href: '/attendance', icon: ScanFace },
    { name: '설정', href: '/m/settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 pb-safe z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href) && (tab.href !== '/m' || pathname === '/m');
          return (
            <Link 
              key={tab.name} 
              href={tab.href}
              className="relative flex flex-col items-center justify-center w-full h-full gap-1 group"
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100/50'}`}>
                <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-blue-100/50 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-tight transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
