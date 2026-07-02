'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Smartphone, Palette, HelpCircle, ChevronRight, HardDrive, Users, Trash2, PlusCircle, RefreshCw, Clock, Save, ScanFace, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { queryTable, insertRows, deleteRows } from '@root/egdesk-helpers';

export default function MobileSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Classes State
  const [classes, setClasses] = useState<{id: number, name: string}[]>([]);
  const [newClassName, setNewClassName] = useState('');
  
  // Usage Stats State
  const [usageStats, setUsageStats] = useState({ faceAuthCount: 0, smsCount: 0 });
  
  // Automation Settings State
  const [refreshInterval, setRefreshInterval] = useState(1);
  const [autoCheckoutMinutes, setAutoCheckoutMinutes] = useState(10);
  
  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Classes
      const classesRes = await queryTable('student_classes');
      setClasses(classesRes.rows || []);
      
      // Fetch System Settings
      const settingsRes = await queryTable('tkd_system_settings');
      const settings = settingsRes.rows || [];
      
      const refresh = settings.find((s: any) => s.key === 'attendance_refresh_interval');
      const checkout = settings.find((s: any) => s.key === 'attendance_auto_checkout_minutes');
      
      if (refresh) setRefreshInterval(Number(refresh.value));
      if (checkout) setAutoCheckoutMinutes(Number(checkout.value));

      // Fetch Usage Statistics
      const usageRes = await fetch('/api/settings/usage');
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsageStats({ faceAuthCount: usageData.faceAuthCount || 0, smsCount: usageData.smsCount || 0 });
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    try {
      await insertRows('student_classes', [{ name: newClassName.trim() }]);
      setNewClassName('');
      const res = await queryTable('student_classes');
      setClasses(res.rows || []);
    } catch (err) {
      alert('반 추가 실패');
    }
  };

  const handleDeleteClass = async (id: number) => {
    if (!confirm('이 반을 삭제하시겠습니까?')) return;
    try {
      await deleteRows('student_classes', { ids: [id] });
      setClasses(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('반 삭제 실패');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await insertRows('tkd_system_settings', [
        { key: 'attendance_refresh_interval', value: String(refreshInterval) },
        { key: 'attendance_auto_checkout_minutes', value: String(autoCheckoutMinutes) }
      ]);
      alert('설정이 저장되었습니다.');
    } catch (err) {
      alert('설정 저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pt-safe pb-24">
      <header className="bg-white/80 backdrop-blur-xl px-5 py-4 sticky top-0 z-10 shadow-sm border-b border-slate-200/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/m/attendance" className="p-2 -ml-2 text-slate-400 hover:text-slate-700 bg-slate-100/50 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">시스템 설정</h1>
        </div>
        <button 
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:bg-slate-300"
        >
          <Save size={16} /> {isSaving ? '저장중' : '저장'}
        </button>
      </header>

      <div className="p-4 flex flex-col gap-6">
        
        {/* Class Management */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
            <Users size={14} /> 수련 반(Class) 관리
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="새로운 반 이름"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all"
              />
              <button
                onClick={handleAddClass}
                className="bg-slate-900 text-white px-4 py-3 rounded-xl font-black text-sm flex items-center gap-1 active:scale-95 transition-all"
              >
                <PlusCircle size={16} /> 추가
              </button>
            </div>
            
            <div className="space-y-2 mt-2">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between bg-slate-50/50 px-4 py-3 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-700">{cls.name}</span>
                  <button
                    onClick={() => handleDeleteClass(cls.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {classes.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm font-medium">등록된 반이 없습니다.</div>
              )}
            </div>
          </div>
        </section>

        {/* Usage Statistics */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
            <ScanFace size={14} /> 서비스 이용 통계
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <ScanFace size={20} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">얼굴 인식</div>
                  <div className="text-[10px] text-slate-500">누적 이용 건수</div>
                </div>
              </div>
              <div className="text-xl font-black text-blue-600">{usageStats.faceAuthCount.toLocaleString()}건</div>
            </div>
            <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">문자 발송</div>
                  <div className="text-[10px] text-slate-500">누적 이용 건수</div>
                </div>
              </div>
              <div className="text-xl font-black text-indigo-600">{usageStats.smsCount.toLocaleString()}건</div>
            </div>
          </div>
        </section>

        {/* Attendance Automation */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw size={14} /> 출결 자동화 설정
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">기록 새로고침</div>
                  <div className="text-[10px] text-slate-400">자동 업데이트 주기</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <input
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-12 text-center bg-transparent font-black text-slate-800 outline-none"
                />
                <span className="text-[10px] font-black text-slate-400 pr-2">분</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">자동 하원 시간</div>
                  <div className="text-[10px] text-slate-400">인식 후 하원 처리 시간</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <input
                  type="number"
                  value={autoCheckoutMinutes}
                  onChange={(e) => setAutoCheckoutMinutes(Number(e.target.value))}
                  className="w-12 text-center bg-transparent font-black text-slate-800 outline-none"
                />
                <span className="text-[10px] font-black text-slate-400 pr-2">분</span>
              </div>
            </div>
          </div>
        </section>

        {/* Existing Sections (Simplified) */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 mb-3 px-2 uppercase tracking-wider">기타 설정</h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
            <div className="flex items-center justify-between p-4 px-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <HardDrive size={20} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">캐시 정리</div>
                </div>
              </div>
              <button onClick={() => { localStorage.clear(); alert('캐시가 초기화되었습니다.'); window.location.reload(); }} className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                정리
              </button>
            </div>
          </div>
        </section>
        
        <div className="text-center mt-4">
          <p className="text-[10px] font-black text-slate-300">EG DESK Mobile v2.1.0</p>
        </div>

      </div>
    </div>
  );
}
