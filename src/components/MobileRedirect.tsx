'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function MobileRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    
    const userAgent = navigator.userAgent || '';
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isMobileWidth = window.innerWidth <= 1024; // 1024px 이하의 모니터는 모바일/태블릿으로 간주

    const isMobile = isMobileUserAgent || isMobileWidth;

    // 만약 모바일 기기로 /admin 또는 / 에 접근하면 /m 으로 리다이렉트
    if (isMobile && (pathname.startsWith('/admin') || pathname === '/')) {
      let mobilePath = '/m';
      if (pathname.startsWith('/admin')) mobilePath = pathname.replace('/admin', '/m');
      
      window.location.replace(mobilePath);
      return;
    }

    // 만약 데스크탑 기기로 /m 에 접근하면 /admin 으로 리다이렉트
    if (!isMobile && pathname.startsWith('/m')) {
      const desktopPath = pathname === '/m' ? '/admin' : pathname.replace('/m', '/admin');
      window.location.replace(desktopPath);
      return;
    }
  }, [pathname, router]);

  return null;
}
