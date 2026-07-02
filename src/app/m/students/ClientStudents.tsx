'use client';

import React, { useState } from 'react';
import { Search, UserPlus, AlertCircle, Phone, Mic, MicOff, Plus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { matchChosung } from '@/utils/koreanUtils';

export default function ClientStudents({ initialStudents, error }: { initialStudents: any[], error?: string | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ON_HOLD' | 'DISCHARGED'>('ACTIVE');

  const filteredStudents = initialStudents.filter(s => {
    const matchesSearch = 
      matchChosung(s.name || '', searchTerm) || 
      (s.parent_phone || '').includes(searchTerm);
    const matchesStatus = (s.status === statusFilter) || (statusFilter === 'ACTIVE' && !s.status);
    return matchesSearch && matchesStatus;
  });

  const handlePhoneClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleCardClick = (id: number) => {
    router.push(`/m/students/edit/${id}`);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.start();
    setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchTerm(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pt-safe pb-24">
      <header className="bg-white/80 backdrop-blur-xl px-5 pt-4 pb-3 sticky top-0 z-10 shadow-sm border-b border-slate-200/50">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-black text-slate-900 tracking-tight shrink-0">관원 목록</h1>
          
          <Link href="/m/students/register" className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 text-white rounded-xl text-[10.5px] font-black shadow-lg shadow-blue-600/20 active:scale-95 transition-transform leading-none">
            <Plus size={14} strokeWidth={4} />
            등록
          </Link>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="이름 또는 연락처 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-12 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
          />
          <button 
            onClick={startListening}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-100 text-red-500 shadow-sm animate-pulse' : 'bg-slate-200 text-slate-400'}`}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
          {[
            { id: 'ACTIVE', label: '재원' },
            { id: 'ON_HOLD', label: '휴관' },
            { id: 'DISCHARGED', label: '퇴관' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                statusFilter === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 flex flex-col gap-3">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {!error && filteredStudents.length > 0 ? (
          filteredStudents.map((student) => (
            <div 
              onClick={() => handleCardClick(student.id)}
              key={student.id} 
              className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 duration-300 active:bg-slate-50 cursor-pointer transition-all relative overflow-hidden ${
                (student.status && student.status !== 'ACTIVE') ? 'opacity-70 grayscale-[0.5]' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-600 rounded-full flex items-center justify-center font-black text-lg shadow-inner overflow-hidden ${
                  (student.status && student.status !== 'ACTIVE') ? 'from-slate-200 to-slate-100 text-slate-400' : ''
                }`}>
                  {student.profile_image ? (
                    <img src={student.profile_image} alt={student.name} className="w-full h-full object-cover" />
                  ) : (
                    student.name.charAt(0)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-slate-800 text-lg">{student.name}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                      {student.class_name || '미지정'}
                    </span>
                    {student.status === 'ON_HOLD' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-600 rounded-md">휴관</span>
                    )}
                    {student.status === 'DISCHARGED' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-md">퇴관</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => student.parent_phone && handlePhoneClick(e, student.parent_phone)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold active:scale-95 transition-transform"
                    >
                      <Phone size={12} fill="currentColor" />
                      {student.parent_phone || '연락처 없음'}
                    </button>
                  </div>
                </div>
              </div>

              {student.last_attendance && (
                <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-300">
                  최근 등원 {student.last_attendance.split('T')[0].substring(5)}
                </div>
              )}
            </div>
          ))
        ) : (
          !error && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Search size={48} strokeWidth={1} className="mb-4" />
              <p className="font-bold">{statusFilter === 'ACTIVE' ? '검색 결과가 없습니다.' : `${statusFilter === 'ON_HOLD' ? '휴관생' : '퇴관생'}이 없습니다.`}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

