'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, UserPlus, MonitorPlay, ClipboardList, Users, Coins, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside style={{ 
      height: '100vh', 
      position: 'sticky', 
      top: 0, 
      padding: '32px',
      borderRight: '1px solid #E2E8F0',
      backgroundColor: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      gap: '40px'
    }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 8px' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 8px 16px -4px rgba(15, 23, 42, 0.15)',
            flexShrink: 0
          }}>
            <Zap size={20} color="#FFFFFF" fill="#FFFFFF" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em' }}>EG</span>
              <span style={{ fontSize: '22px', fontWeight: 300, color: '#64748B', letterSpacing: '-0.02em' }}>DESK</span>
            </div>
            <div style={{ 
              fontSize: '9px', 
              fontWeight: 800, 
              color: '#3B82F6', 
              textTransform: 'uppercase', 
              letterSpacing: '0.15em',
              marginTop: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '4px', height: '4px', backgroundColor: '#3B82F6', borderRadius: '50%' }}></span>
              AI TAEKWONDO
            </div>
          </div>
        </div>
      </Link>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { href: "/admin/students/register", icon: UserPlus, label: "신규 관원 등록", color: "#2563EB" },
          { href: "/attendance", icon: MonitorPlay, label: "출석 모니터 시작", color: "#10B981" },
          { href: "/admin/attendance", icon: ClipboardList, label: "출결 기록 관리", color: "#6366F1" },
          { href: "/admin/students", icon: Users, label: "전체 관원 관리", color: "#0EA5E9" },
        ].map((item) => (
          <Link key={item.href} href={item.href} target={item.target} rel={item.target ? "noopener noreferrer" : undefined} style={{ textDecoration: 'none' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              padding: '16px', 
              borderRadius: '20px', 
              backgroundColor: '#F8FAFC',
              transition: 'all 0.2s'
            }}>
              <item.icon size={20} color={item.color} />
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#475569' }}>{item.label}</span>
            </div>
          </Link>
        ))}

        <Link href="/admin/payments" style={{ textDecoration: 'none' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px', 
            padding: '16px', 
            borderRadius: '20px', 
            backgroundColor: '#F8FAFC',
            transition: 'all 0.2s'
          }}>
            <Coins size={20} color="#E11D48" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#475569' }}>수납 내역 관리</span>
          </div>
        </Link>

        <div style={{ margin: '16px 0', borderTop: '1px solid #F1F5F9' }}></div>

        <Link href="/admin/settings" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '20px', backgroundColor: '#F8FAFC' }}>
            <Settings size={20} color="#94A3B8" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#475569' }}>시스템 설정</span>
          </div>
        </Link>
      </nav>
    </aside>
  );
}
