'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, Users, Trash2, PlusCircle, MessageSquare, Send } from 'lucide-react';
import { queryTable, insertRows, deleteRows, createTable } from '@root/egdesk-helpers';
import { sendAttendanceSMSAction } from '../../actions/sms';

export default function SettingsPage() {
  const [status, setStatus] = useState('');
  const [usageStats, setUsageStats] = useState({ faceCount: 0, smsCount: 0, currentMonth: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [testStudentId, setTestStudentId] = useState('1');
  const [testStatus, setTestStatus] = useState('대기 중...');
  const [isTesting, setIsTesting] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [setupModalStatus, setSetupModalStatus] = useState('');
  const [classes, setClasses] = useState<{id: number, name: string}[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [attendanceRefreshInterval, setAttendanceRefreshInterval] = useState(1);
  const [attendanceAutoCheckoutMinutes, setAttendanceAutoCheckoutMinutes] = useState(10);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsTemplateIn, setSmsTemplateIn] = useState('[EG태권도] {name} 학생이 {time}에 등원하였습니다.');
  const [smsTemplateOut, setSmsTemplateOut] = useState('[EG태권도] {name} 학생이 {time}에 하원하였습니다.');

  const [initialSettings, setInitialSettings] = useState({
    attendanceRefreshInterval: 1,
    attendanceAutoCheckoutMinutes: 10,
    smsEnabled: false,
    smsTemplateIn: '[EG태권도] {name} 학생이 {time}에 등원하였습니다.',
    smsTemplateOut: '[EG태권도] {name} 학생이 {time}에 하원하였습니다.'
  });

  const hasChanges = 
    attendanceRefreshInterval !== initialSettings.attendanceRefreshInterval ||
    attendanceAutoCheckoutMinutes !== initialSettings.attendanceAutoCheckoutMinutes ||
    smsEnabled !== initialSettings.smsEnabled ||
    smsTemplateIn !== initialSettings.smsTemplateIn ||
    smsTemplateOut !== initialSettings.smsTemplateOut;

  useEffect(() => {
    if (testStatus === '대기 중...' || testStatus === '문자 발송 가능' || testStatus === '문자 발송 불가') {
      setTestStatus(smsEnabled ? '문자 발송 가능' : '문자 발송 불가');
    }
  }, [smsEnabled]);

  useEffect(() => {
    const fetchUsageStats = async () => {
      try {
        const res = await fetch('/api/settings/usage');
        const data = await res.json();
        if (data.success) {
          setUsageStats({ faceCount: data.faceCount, smsCount: data.smsCount, currentMonth: data.currentMonth });
        }
      } catch (err) {
        console.error('통계 로드 실패:', err);
      }
    };
    fetchUsageStats();
    
    const interval = setInterval(fetchUsageStats, 5000);

    const fetchValidStudentId = async () => {
      try {
        const res = await queryTable('students');
        if (res.rows && res.rows.length > 0) {
          setTestStudentId(String(res.rows[0].id));
        }
      } catch (err) {
        console.error('학생 ID 로드 실패:', err);
      }
    };
    fetchValidStudentId();
    fetchClasses();
    fetchSystemSettings();
    
    return () => clearInterval(interval);
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const res = await queryTable('tkd_system_settings');
      const settings = res.rows || [];
      
      // 데이터가 아예 없는 경우(테이블은 있지만) 기본값 삽입을 유도하기 위해 빈 배열 처리
      if (settings.length === 0) {
        throw new Error('INITIALIZE_REQUIRED');
      }

      const refresh = settings.find((s: any) => s.key === 'attendance_refresh_interval');
      const checkout = settings.find((s: any) => s.key === 'attendance_auto_checkout_minutes');
      const smsOn = settings.find((s: any) => s.key === 'sms_enabled');
      const tplIn = settings.find((s: any) => s.key === 'sms_template_in');
      const tplOut = settings.find((s: any) => s.key === 'sms_template_out');
      
      if (refresh) setAttendanceRefreshInterval(Number(refresh.value));
      if (checkout) setAttendanceAutoCheckoutMinutes(Number(checkout.value));
      if (smsOn) setSmsEnabled(smsOn.value === 'true');
      if (tplIn) setSmsTemplateIn(tplIn.value);
      if (tplOut) setSmsTemplateOut(tplOut.value);
      
      setInitialSettings({
        attendanceRefreshInterval: refresh ? Number(refresh.value) : 1,
        attendanceAutoCheckoutMinutes: checkout ? Number(checkout.value) : 10,
        smsEnabled: smsOn ? smsOn.value === 'true' : false,
        smsTemplateIn: tplIn ? tplIn.value : '[EG태권도] {name} 학생이 {time}에 등원하였습니다.',
        smsTemplateOut: tplOut ? tplOut.value : '[EG태권도] {name} 학생이 {time}에 하원하였습니다.'
      });
    } catch (err: any) {
      console.warn('시스템 설정 로드 중 안내:', err.message);
      
      try {
        // 1. 테이블이 없는 경우에만 생성을 시도 (이미 있으면 에러가 나지만 무시됨)
        if (err.message !== 'INITIALIZE_REQUIRED') {
          try {
            await createTable('태권도 시스템 설정', [
              { name: 'key', type: 'TEXT', notNull: true },
              { name: 'value', type: 'TEXT' }
            ], { tableName: 'tkd_system_settings', uniqueKeyColumns: ['key'], duplicateAction: 'update' });
            console.log('tkd_system_settings 테이블 생성 완료');
          } catch (createErr: any) {
            if (createErr.message?.includes('UNIQUE constraint failed')) {
              console.log('이미 테이블이 존재합니다. 생성을 건너뜁니다.');
            } else {
              throw createErr;
            }
          }
        }
        
        // 2. 기본값들 삽입 (중복 방지 로직이 createTable 옵션에 있으므로 안전)
        await insertRows('tkd_system_settings', [
          { key: 'attendance_refresh_interval', value: '1' },
          { key: 'attendance_auto_checkout_minutes', value: '10' },
          { key: 'sms_enabled', value: 'false' },
          { key: 'sms_template_in', value: '[EG태권도] {name} 학생이 {time}에 등원하였습니다.' },
          { key: 'sms_template_out', value: '[EG태권도] {name} 학생이 {time}에 하원하였습니다.' }
        ]);
        
        console.log('tkd_system_settings 데이터 초기화 완료');
        // 초기화 성공 후 다시 로드
        const retryRes = await queryTable('tkd_system_settings');
        const retryRows = retryRes.rows || [];
        if (retryRows.length > 0) {
          const refresh = retryRows.find((s: any) => s.key === 'attendance_refresh_interval');
          const checkout = retryRows.find((s: any) => s.key === 'attendance_auto_checkout_minutes');
          const smsOn = retryRows.find((s: any) => s.key === 'sms_enabled');
          const tplIn = retryRows.find((s: any) => s.key === 'sms_template_in');
          const tplOut = retryRows.find((s: any) => s.key === 'sms_template_out');
          
          if (refresh) setAttendanceRefreshInterval(Number(refresh.value));
          if (checkout) setAttendanceAutoCheckoutMinutes(Number(checkout.value));
          if (smsOn) setSmsEnabled(smsOn.value === 'true');
          if (tplIn) setSmsTemplateIn(tplIn.value);
          if (tplOut) setSmsTemplateOut(tplOut.value);

          setInitialSettings({
            attendanceRefreshInterval: refresh ? Number(refresh.value) : 1,
            attendanceAutoCheckoutMinutes: checkout ? Number(checkout.value) : 10,
            smsEnabled: smsOn ? smsOn.value === 'true' : false,
            smsTemplateIn: tplIn ? tplIn.value : '[EG태권도] {name} 학생이 {time}에 등원하였습니다.',
            smsTemplateOut: tplOut ? tplOut.value : '[EG태권도] {name} 학생이 {time}에 하원하였습니다.'
          });
        }
      } catch (finalErr) {
        console.error('최종 초기화 실패:', finalErr);
        setStatus('시스템 설정 초기화 중 오류가 발생했습니다.');
      }
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await queryTable('student_classes');
      setClasses(res.rows || []);
    } catch (err) {
      console.error('반 로드 실패:', err);
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    try {
      await insertRows('student_classes', [{ name: newClassName.trim() }]);
      setNewClassName('');
      fetchClasses();
    } catch (err) {
      console.error('반 추가 실패:', err);
    }
  };

  const handleDeleteClass = async (id: number) => {
    if (!confirm('이 반을 삭제하시겠습니까? 관련 관원 정보는 유지되지만 등록 시 선택할 수 없게 됩니다.')) return;
    try {
      await deleteRows('student_classes', { ids: [id] });
      fetchClasses();
    } catch (err) {
      console.error('반 삭제 실패:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus('저장 중...');

    try {
      // 1. 시스템 설정 저장 (tkd_system_settings)
      try {
        await insertRows('tkd_system_settings', [
          { key: 'attendance_refresh_interval', value: String(attendanceRefreshInterval) },
          { key: 'attendance_auto_checkout_minutes', value: String(attendanceAutoCheckoutMinutes) },
          { key: 'sms_enabled', value: String(smsEnabled) },
          { key: 'sms_template_in', value: smsTemplateIn },
          { key: 'sms_template_out', value: smsTemplateOut }
        ]);
      } catch (dbErr: any) {
        throw new Error(`데이터베이스 저장 실패: ${dbErr.message}`);
      }
      
      setStatus('설정이 저장되었습니다!');
      alert('모든 설정이 성공적으로 저장되었습니다.');
      
      setInitialSettings({
        attendanceRefreshInterval,
        attendanceAutoCheckoutMinutes,
        smsEnabled,
        smsTemplateIn,
        smsTemplateOut
      });
    } catch (err: any) {
      console.error('설정 저장 실패 상세:', err);
      setStatus(`저장 실패: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testStudentId) {
      alert('테스트할 학생 ID를 입력해주세요.');
      return;
    }
    
    setIsTesting(true);
    setTestStatus('발송 중... (약 5~10초 소요)');
    try {
      const res = await sendAttendanceSMSAction(Number(testStudentId), 'IN');
      if (res.success) {
        setTestStatus('발송 성공! 휴대폰을 확인해주세요.');
      } else {
        const rawError = res.error || '알 수 없는 오류';
        let errorMsg = typeof rawError === 'string' ? rawError : (rawError.message || String(rawError));
        if (errorMsg.includes('Timeout') || errorMsg.includes('locator.focus') || errorMsg.includes('waiting for locator')) {
          errorMsg = '기기 연동이 해제되었습니다.\n[기기 연동하기] 버튼을 눌러 다시 연결해 주세요.';
        } else if (errorMsg.includes('Session closed')) {
          errorMsg = '브라우저 세션이 끊어졌습니다.\n잠시 후 다시 시도해 주세요.';
        }
        setTestStatus(`발송 실패: ${errorMsg}`);
      }
    } catch (err: any) {
      setTestStatus(`오류 발생:\n시스템 상태를 확인해 주세요 (${err.message})`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '40px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.05em' }}>시스템 설정</h2>
        </div>
      </header>

      <main className="max-w-3xl flex flex-col gap-1 relative z-10">
        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200">
                <Bot size={24} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">이번 달 서비스 사용 통계</h2>
                <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{usageStats.currentMonth || '로딩 중...'} 기준</p>
              </div>
            </div>
            
            <a
              href={`/api/settings/usage/download?month=${usageStats.currentMonth || ''}`}
              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border border-indigo-100 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              엑셀로 다운로드
            </a>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50/80 p-8 rounded-[32px] border border-slate-100 flex flex-col justify-between group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
              <div className="relative z-10">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-6">얼굴 인식 출결 건수</label>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black text-slate-800 tracking-tighter leading-none">{usageStats.faceCount.toLocaleString()}</span>
                  <span className="text-sm font-bold text-slate-400 mb-1">건</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 p-8 rounded-[32px] border border-slate-100 flex flex-col justify-between group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
              <div className="relative z-10">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-6">알림 문자 발송 건수</label>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black text-slate-800 tracking-tighter leading-none">{usageStats.smsCount.toLocaleString()}</span>
                  <span className="text-sm font-bold text-slate-400 mb-1">건</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Class Management Section */}
        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200">
              <Users size={24} strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">수련 반(Class) 관리</h2>
          </div>

          <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 mb-8">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">새로운 반 추가</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="예: 주말 심화반, 성인부 등"
                className="flex-1 bg-white border-2 border-slate-200 rounded-[20px] px-8 py-6 font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
              />
              <button
                onClick={handleAddClass}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', boxShadow: '0 8px 16px -4px rgba(37,99,235,0.4)' }}
                className="hover:bg-blue-700 px-8 rounded-[20px] font-black transition-all flex items-center gap-2 border-none cursor-pointer"
              >
                <PlusCircle size={20} /> 추가
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {classes.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between bg-white px-8 py-6 rounded-[20px] border border-slate-100 shadow-sm group hover:border-slate-300 transition-all">
                <span className="font-black text-slate-700 text-lg">{cls.name}</span>
                <button
                  onClick={() => handleDeleteClass(cls.id)}
                  className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Automation Settings */}
        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200">
              <PlusCircle size={24} strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">출결 자동화 설정</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/30">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4 block group-hover:text-amber-500">출결 기록 자동 새로고침</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={attendanceRefreshInterval}
                  onChange={(e) => setAttendanceRefreshInterval(Number(e.target.value))}
                  style={{ width: '80px', textAlign: 'center' }}
                  className="bg-white border-2 border-slate-200 rounded-[16px] px-4 py-3 font-black text-lg text-slate-900 focus:border-amber-500 outline-none transition-all shadow-sm"
                />
                <span className="font-bold text-slate-600 text-sm">분 마다</span>
              </div>
              <p className="mt-4 text-[11px] text-slate-400 font-medium leading-relaxed">관리자 화면의 출결 목록이 설정된 시간마다 자동으로 새로고침됩니다.</p>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/30">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4 block group-hover:text-blue-500">자동 하원 처리 시간</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={attendanceAutoCheckoutMinutes}
                  onChange={(e) => setAttendanceAutoCheckoutMinutes(Number(e.target.value))}
                  style={{ width: '80px', textAlign: 'center' }}
                  className="bg-white border-2 border-slate-200 rounded-[16px] px-4 py-3 font-black text-lg text-slate-900 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
                <span className="font-bold text-slate-600 text-sm">분 이후</span>
              </div>
              <p className="mt-4 text-[11px] text-slate-400 font-medium leading-relaxed">등원 후 설정된 시간이 지나고 다시 얼굴이 인식되면 자동으로 하원 처리됩니다.</p>
            </div>
          </div>
        </div>

        {/* SMS Notification Settings */}
        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200">
                <MessageSquare size={24} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">학부모 알림 문자 설정</h2>
                <p className="text-[10px] text-slate-400 font-bold">Google 메시지(Web) 연동</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  setIsSetupModalOpen(true);
                  setSetupModalStatus('');
                }}
                className="rounded-[16px] font-black transition-all border-none cursor-pointer hover:opacity-90 active:scale-95 whitespace-nowrap text-sm flex items-center justify-center"
                style={{
                  height: '44px',
                  padding: '0 24px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 8px 16px -4px rgba(37,99,235,0.4)'
                }}
              >
                기기 연동하기
              </button>
              
              <div 
                className="flex items-center gap-3 cursor-pointer" 
                onClick={() => setSmsEnabled(!smsEnabled)}
              >
                {/* 100% 안전한 인라인 스타일 토글 스위치 */}
                <div 
                  style={{ 
                    width: '60px', 
                    height: '34px', 
                    borderRadius: '999px', 
                    backgroundColor: smsEnabled ? '#2563eb' : '#cbd5e1',
                    position: 'relative',
                    transition: 'background-color 0.3s ease'
                  }}
                >
                  <div 
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: '4px',
                      left: smsEnabled ? '30px' : '4px',
                      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                  />
                </div>
                <span 
                  style={{ 
                    fontSize: '16px', 
                    fontWeight: 900, 
                    color: smsEnabled ? '#2563eb' : '#94a3b8',
                    userSelect: 'none'
                  }}
                >
                  {smsEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          <div className={`space-y-8 transition-all duration-500 ${smsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">등원 알림 메시지</label>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">사용 가능 변수: {'{name}, {time}, {parent}'}</span>
                </div>
                <textarea
                  value={smsTemplateIn}
                  onChange={(e) => setSmsTemplateIn(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] p-6 font-bold text-slate-700 h-32 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none"
                  placeholder="등원 시 발송될 메시지 내용을 입력하세요."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">하원 알림 메시지</label>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">사용 가능 변수: {'{name}, {time}, {parent}'}</span>
                </div>
                <textarea
                  value={smsTemplateOut}
                  onChange={(e) => setSmsTemplateOut(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-[24px] p-6 font-bold text-slate-700 h-32 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none"
                  placeholder="하원 시 발송될 메시지 내용을 입력하세요."
                />
              </div>
            </div>
            
            <div className="bg-emerald-50 p-6 rounded-[24px] border border-emerald-100 flex gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-600">
                <Bot size={20} />
              </div>
              <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                현재 **Google 메시지 웹 연동 모드**입니다. 기기 연동이 완료된 경우, 실제 문자가 연동된 휴대폰을 통해 발송됩니다. 
                연동이 해제된 경우 발송에 실패할 수 있으니 주의해 주세요.
              </p>
            </div>
          </div>
          
          {/* SMS Testing Section (Always visible, regardless of smsEnabled toggle) */}
          <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 mt-8 relative z-10">
            <div className="flex items-center mb-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">문자 발송 테스트</label>
            </div>
            <div className="flex flex-col gap-4">
              {/* Row 1: Input and Button */}
              <div className="flex items-center justify-center gap-4">
                <div 
                  className="flex items-center gap-3 bg-white px-4 rounded-[16px] border-2 border-slate-200 shadow-sm box-border"
                  style={{ height: '44px' }}
                >
                  <span className="text-sm font-bold text-slate-500">학생 ID:</span>
                  <input
                    type="number"
                    value={testStudentId}
                    onChange={(e) => setTestStudentId(e.target.value)}
                    className="w-16 text-center font-black text-lg text-slate-800 outline-none bg-transparent"
                    min="1"
                  />
                </div>
                
                <button
                  onClick={handleTestSMS}
                  disabled={isTesting}
                  style={{
                    height: '44px',
                    padding: '0 24px',
                    backgroundColor: isTesting ? '#e2e8f0' : '#2563eb',
                    color: isTesting ? '#94a3b8' : '#ffffff',
                    boxShadow: isTesting ? 'none' : '0 8px 16px -4px rgba(37,99,235,0.4)'
                  }}
                  className="flex items-center justify-center gap-2 rounded-[16px] font-black transition-all border-none cursor-pointer hover:opacity-90 active:scale-95 whitespace-nowrap text-sm"
                >
                  <Send size={18} />
                  {isTesting ? '발송 중...' : '테스트 문자 발송'}
                </button>
              </div>
              
              {/* Row 2: Status Message */}
              <div 
                className={`text-sm font-bold px-4 py-3 rounded-xl text-center transition-colors shadow-sm whitespace-pre-line ${
                  testStatus.includes('성공') ? 'text-emerald-600 bg-emerald-50' : 
                  testStatus.includes('실패') || testStatus.includes('오류') ? 'text-rose-600 bg-rose-50' : 
                  testStatus.includes('발송 중') ? 'text-blue-600 bg-blue-50 animate-pulse' :
                  'text-slate-500 bg-white border border-slate-200'
                }`}
                style={{ width: '50%', margin: '0 auto', lineHeight: '1.5' }}
              >
                {testStatus}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/60 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
          <p className={`text-sm font-bold flex items-center gap-2 px-4 ${status.includes('실패') ? 'text-rose-500' : 'text-blue-600'}`}>
            {status && (
              <>
                <span className={`w-2 h-2 rounded-full animate-pulse ${status.includes('실패') ? 'bg-rose-500' : 'bg-blue-500'}`}></span>
                {status}
              </>
            )}
          </p>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{ 
                padding: '26px 40px',
                backgroundColor: isSaving ? '#e2e8f0' : '#2563eb', 
                color: isSaving ? '#94a3b8' : '#ffffff',
                boxShadow: isSaving ? 'none' : '0 12px 24px -8px rgba(37,99,235,0.4)'
              }}
              className="rounded-[24px] font-black text-lg transition-all active:scale-95 w-full md:w-auto border-none cursor-pointer"
            >
              {isSaving ? '처리 중...' : '설정 안전하게 저장'}
            </button>
          )}
        </div>

        {/* Setup Modal */}
        {isSetupModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 md:p-10 rounded-[32px] shadow-2xl max-w-md w-full relative transform transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100">
                  <Bot size={24} strokeWidth={2} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">기기 연동하기</h3>
              </div>
              
              <p className="text-slate-600 font-medium leading-relaxed mb-8">
                작업 표시줄에 열린 새 창(서버 브라우저)에서 Google 메시지 로그인을 완료해 주세요.
              </p>
              
              {setupModalStatus && (
                <div className={`mb-6 p-4 rounded-xl text-sm font-bold text-center ${setupModalStatus.includes('실패') || setupModalStatus.includes('오류') ? 'bg-rose-50 text-rose-600' : setupModalStatus.includes('완료') ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600 animate-pulse'}`}>
                  {setupModalStatus}
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setIsSetupModalOpen(false);
                    if (setupModalStatus.includes('완료')) {
                      setStatus('연동 완료');
                    }
                  }}
                  className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 py-4 rounded-[16px] font-black transition-colors"
                >
                  닫기
                </button>
                <button 
                  onClick={async () => {
                    setSetupModalStatus('기기 연동 대기 중...');
                    try {
                      const res = await fetch('/api/sms/setup');
                      const data = await res.json();
                      
                      if (res.ok) {
                        setSetupModalStatus('기기 연동이 완료되었습니다.');
                      } else {
                        const errorMsg = data.error || '연동에 실패하였습니다.';
                        setSetupModalStatus(`연동 실패: ${errorMsg}`);
                      }
                    } catch (err) {
                      console.error(err);
                      setSetupModalStatus('오류가 발생했습니다.');
                    }
                  }}
                  disabled={setupModalStatus === '기기 연동 대기 중...'}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-4 rounded-[16px] font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  연동 시작
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
