'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, LogOut, SearchX, AlertCircle, Phone, UserX, Clock, Search, Mic, MicOff, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { matchChosung } from '@/utils/koreanUtils';
import { insertRows } from '@root/egdesk-helpers';
import { sendAttendanceSMSBatchAction, createAttendanceLogsAction } from '../../actions/sms';

export default function ClientAttendanceLogs({ initialLogs, allStudents, error }: { initialLogs: any[], allStudents: any[], error?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'daily';
  const [isPending, startTransition] = React.useTransition();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isListening, setIsListening] = React.useState(false);
  const [now, setNow] = React.useState(new Date());
  
  const [filter, setFilter] = React.useState<'ALL' | 'NOT_IN' | 'NOT_OUT'>('ALL');
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [processedIds, setProcessedIds] = React.useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [sendSmsOnBatch, setSendSmsOnBatch] = React.useState(false);

  const failedSmsCount = React.useMemo(() => {
    return initialLogs.filter(l => l.sms_status === 'FAILED').length;
  }, [initialLogs]);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    setSelectedIds([]);
  }, [filter]);

  const handleAttendanceProcess = async () => {
    if (selectedIds.length === 0) return;
    
    setIsProcessing(true);
    const currentSelected = [...selectedIds];
    const type = filter === 'NOT_IN' ? 'IN' : 'OUT';

    try {
      // 한국 현지 시간 포맷 생성 (YYYY-MM-DD HH:mm:ss)
      const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
      
      // 1. [낙관적 업데이트] UI에서 관원 즉시 숨기기 및 선택 초기화
      setProcessedIds(prev => {
        const next = new Set(prev);
        currentSelected.forEach(id => next.add(id));
        return next;
      });
      setSelectedIds([]);

      // 2. [서버 처리 - 1단계: DB 저장]
      // 저장만 먼저 하고 즉시 응답을 받습니다.
      const saveRes = await createAttendanceLogsAction(currentSelected.map(id => ({ studentId: id, type })), timestamp);
      
      if (saveRes && saveRes.success) {
        // 저장이 완료되면 즉시 UI 갱신 요청 (전체 탭에 학생이 바로 나타남)
        router.refresh();
        console.log('DB 저장 완료, 목록 갱신');
      }

      // 3. [서버 처리 - 2단계: 문자 발송]
      if (sendSmsOnBatch) {
        const smsRequests = currentSelected.map(id => ({ studentId: id, type }));
        sendAttendanceSMSBatchAction(smsRequests, timestamp).then(res => {
          if (res && res.success) {
            console.log(`${currentSelected.length}명 문자 발송 프로세스 완료`);
          }
          router.refresh(); // 최종 상태(성공/실패 배지) 반영을 위해 한 번 더 갱신
        });
      }

      // 로딩 상태 해제 (저장만 끝나면 바로 해제)
      setIsProcessing(false);

      // 성공 알림
      setTimeout(() => {
        alert(`${currentSelected.length}명의 출결 기록이 완료되었습니다.${sendSmsOnBatch ? '\n문자는 백그라운드에서 발송 중입니다.' : ''}`);
      }, 100);

    } catch (err) {
      console.error(err);
      alert('출결 처리 중 오류가 발생했습니다.');
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: number) => {
    if (processedIds.has(id)) return;
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRetrySms = async (e: React.MouseEvent, studentId: number, type: 'IN' | 'OUT') => {
    e.stopPropagation();
    try {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = '<div class="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>';
      
      await sendAttendanceSMSBatchAction([{ studentId, type }]);
      router.refresh();
      alert('문자 재발송 요청 완료');
    } catch (err) {
      console.error(err);
      alert('재발송 중 오류 발생');
    }
  };

  const formatDate = (date: Date) => {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const day = days[date.getDay()];
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${m}/${d} ${day} ${h}:${min}`;
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.start();
    setIsListening(true);
    recognition.onresult = (event: any) => {
      setSearchTerm(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
  };

  const handlePhoneClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const switchMode = (newMode: string) => {
    startTransition(() => {
      router.push(`/m/attendance?mode=${newMode}`);
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pt-safe pb-32">
      <header className="bg-white/80 backdrop-blur-xl px-5 pt-4 pb-3 sticky top-0 z-10 shadow-sm border-b border-slate-200/50">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-black text-slate-900 tracking-tight shrink-0">출결 기록</h1>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            {mode === 'daily' ? (
              <input
                type="date"
                value={searchParams.get('date') || (() => {
                  const tzOffset = 9 * 60 * 60000;
                  return new Date(Date.now() + tzOffset).toISOString().split('T')[0];
                })()}
                onChange={(e) => {
                  startTransition(() => {
                    router.push(`/m/attendance?mode=daily&date=${e.target.value}`);
                  });
                }}
                className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shadow-sm border border-blue-100/50 outline-none text-center"
              />
            ) : (
              <input
                type="month"
                value={`${searchParams.get('year') || new Date().getFullYear()}-${searchParams.get('month') || String(new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [year, month] = e.target.value.split('-');
                  startTransition(() => {
                    router.push(`/m/attendance?mode=monthly&year=${year}&month=${month}`);
                  });
                }}
                className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shadow-sm border border-blue-100/50 outline-none text-center"
              />
            )}
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl relative min-w-[100px]">
            <button onClick={() => switchMode('daily')} className={`flex-1 px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${mode === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>일일</button>
            <button onClick={() => switchMode('monthly')} className={`flex-1 px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${mode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>월간</button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-12 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
          <button onClick={startListening} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        </div>

        {mode === 'daily' && (
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
            {(() => {
              const inIds = new Set(initialLogs.filter(l => l.type === 'IN').map(l => l.student_id));
              const outIds = new Set(initialLogs.filter(l => l.type === 'OUT').map(l => l.student_id));
              processedIds.forEach(id => {
                const log = initialLogs.find(l => l.student_id === id);
                if (!log || log.type !== 'IN') inIds.add(id);
                else outIds.add(id);
              });
              const activeCount = allStudents.filter(s => s.status === 'ACTIVE' || !s.status).length;
              const notInCount = activeCount - inIds.size;
              const notOutCount = inIds.size - outIds.size;
              return [
                { id: 'ALL', label: '전체', count: initialLogs.length + (filter === 'ALL' ? 0 : processedIds.size) },
                { id: 'NOT_IN', label: '미등원', count: notInCount > 0 ? notInCount : 0 },
                { id: 'NOT_OUT', label: '미하원', count: notOutCount > 0 ? notOutCount : 0 }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setFilter(tab.id as any)} className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${filter === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${filter === tab.id ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>{tab.count}</span>
                </button>
              ));
            })()}
          </div>
        )}
      </header>

      <div className="p-4 flex flex-col gap-3">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-semibold">{error}</div>}
        {failedSmsCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 text-sm font-bold">문자 발송 실패 {failedSmsCount}건</p>
              <p className="text-red-600 text-xs mt-1">'전체' 탭에서 재전송 가능합니다.</p>
            </div>
          </div>
        )}

        {(() => {
          if (mode === 'monthly') {
            return allStudents.filter(s => matchChosung(s.name || '', searchTerm)).map(s => (
              <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center font-black text-slate-400 text-sm">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{s.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{s.class_name || '미지정'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-blue-600">{initialLogs.filter(l => l.student_id === s.id && l.type === 'IN').length}회</div>
                </div>
              </div>
            ));
          }

          let displayLogs = initialLogs;
          if (searchTerm) {
            displayLogs = displayLogs.filter(log => matchChosung(log.student_name || '', searchTerm));
          }
          
          if (filter === 'NOT_IN') {
            const inIds = new Set(initialLogs.filter(l => l.type === 'IN').map(l => l.student_id));
            displayLogs = allStudents
              .filter(s => (s.status === 'ACTIVE' || !s.status) && !inIds.has(s.id))
              .filter(s => !processedIds.has(s.id))
              .filter(s => matchChosung(s.name || '', searchTerm))
              .map(s => ({ id: `not-in-${s.id}`, student_id: s.id, student_name: s.name, class_name: s.class_name, parent_phone: s.parent_phone, type: 'ABSENT', timestamp: '' }));
          } else if (filter === 'NOT_OUT') {
            const outIds = new Set(initialLogs.filter(l => l.type === 'OUT').map(l => l.student_id));
            const latestInMap = new Map();
            initialLogs.forEach(l => { if (l.type === 'IN') latestInMap.set(l.student_id, l); });
            displayLogs = Array.from(latestInMap.values())
              .filter((l: any) => !outIds.has(l.student_id) && !processedIds.has(l.student_id))
              .filter((l: any) => matchChosung(l.student_name || '', searchTerm));
          }

          if (displayLogs.length === 0) return <div className="text-center py-20 text-slate-400 font-bold">기록이 없습니다.</div>;

          return displayLogs.map((log) => {
            const isSelected = selectedIds.includes(log.student_id);
            const isManualTab = filter === 'NOT_IN' || filter === 'NOT_OUT';
            return (
              <div key={log.id} onClick={() => isManualTab && toggleSelection(log.student_id)} className={`bg-white rounded-2xl p-4 shadow-sm border transition-all flex items-center gap-4 ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'}`}>
                <div className="w-12 h-12 bg-slate-50 text-blue-600 rounded-full flex items-center justify-center font-black text-lg shrink-0 overflow-hidden">
                  {log.profile_image ? <img src={log.profile_image} className="w-full h-full object-cover" /> : (log.student_name || '').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-slate-900 text-lg">{log.student_name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg">{log.class_name || '일반'}</span>
                    {!isManualTab && <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${log.type === 'IN' ? 'bg-blue-600 text-white' : 'bg-rose-500 text-white'}`}>{log.type === 'IN' ? '등원' : '하원'}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    {log.parent_phone && (
                      <button onClick={(e) => handlePhoneClick(e, log.parent_phone)} className="flex items-center gap-1 text-blue-600 text-xs font-bold">
                        <Phone size={12} fill="currentColor" /> {log.parent_phone}
                      </button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="flex items-center gap-1 text-slate-400 text-[11px] font-bold">
                        <Clock size={12} /> {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </div>
                      {!isManualTab && (
                        <div className="flex gap-1">
                          {log.sms_status === 'FAILED' && <span className="text-[10px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-lg border border-red-100">실패</span>}
                          {log.sms_status === 'SENDING' && <Loader2 size={12} className="animate-spin text-blue-500" />}
                          {log.sms_status === 'SUCCESS' && <CheckCircle2 size={12} className="text-emerald-500" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {isManualTab && <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}>{isSelected && <Check size={14} />}</div>}
              </div>
            );
          });
        })()}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-xs px-5 z-20 flex flex-col gap-2">
          <label className="flex items-center justify-center gap-2 bg-white/90 backdrop-blur-md py-2 px-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer">
            <input 
              type="checkbox" 
              checked={sendSmsOnBatch} 
              onChange={(e) => setSendSmsOnBatch(e.target.checked)} 
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm font-bold text-slate-700">문자 발송 포함</span>
          </label>
          <button onClick={handleAttendanceProcess} disabled={isProcessing} className="w-full bg-slate-900 text-white py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            <span className="font-black text-lg">{selectedIds.length}명 {filter === 'NOT_IN' ? '등원' : '하원'}처리</span>
          </button>
        </div>
      )}
    </div>
  );
}
