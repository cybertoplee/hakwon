'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { RefreshCw, Download, Search } from 'lucide-react';
import { queryTable, deleteRows, executeSQL } from '@root/egdesk-helpers';
import { matchChosung } from '@/utils/koreanUtils';
import { createAttendanceLogsAction, sendAttendanceSMSBatchAction } from '@/app/actions/sms';

interface AttendanceLog {
  id: number;
  student_id: number;
  timestamp: string;
  type: string;
  status: string;
  sms_status?: 'NONE' | 'SENDING' | 'SUCCESS' | 'FAILED';
  student_name?: string;
}

export default function AttendanceManagementPage() {
  const [viewMode, setViewMode] = useState<'list' | 'monthly'>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'not_in' | 'not_out'>('all');
  const [refreshInterval, setRefreshInterval] = useState(1); // minutes
  
  const [classMap, setClassMap] = useState<Record<number, string>>({});
  
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<Record<number, Record<number, string[]>>>({}); // studentId -> day -> types[]
  
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sendSmsOnBatch, setSendSmsOnBatch] = useState(false);

  const handleBatchProcess = async (type: 'IN' | 'OUT', targetStudentIds: number[]) => {
    if (targetStudentIds.length === 0) return;
    if (!confirm(`${targetStudentIds.length}명의 관원을 일괄 ${type === 'IN' ? '등원' : '하원'} 처리하시겠습니까?${sendSmsOnBatch ? '\n문자 발송이 설정된 관원은 자동으로 문자가 발송됩니다.' : ''}`)) return;

    setIsProcessing(true);
    try {
      const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
      const requests = targetStudentIds.map(id => ({ studentId: id, type }));
      
      const saveRes = await createAttendanceLogsAction(requests, timestamp);
      if (saveRes && saveRes.success) {
        fetchLogs();
      }

      if (sendSmsOnBatch) {
        sendAttendanceSMSBatchAction(requests, timestamp).then(() => {
          fetchLogs();
        });
      }

      alert(`일괄 ${type === 'IN' ? '등원' : '하원'} 처리가 시작되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (viewMode === 'list') {
      fetchLogs();
    } else {
      fetchMonthlyLogs();
    }
    fetchRefreshSettings();
  }, [viewMode, selectedMonth, selectedDate]);

  const fetchRefreshSettings = async () => {
    try {
      const res = await queryTable('tkd_system_settings');
      const settings = res.rows || [];
      const refresh = settings.find((s: any) => s.key === 'attendance_refresh_interval');
      if (refresh) setRefreshInterval(Number(refresh.value));
    } catch (err) {
      console.warn('시스템 설정 테이블을 찾을 수 없어 기본 새로고침 주기를 사용합니다.');
    }
  };

  useEffect(() => {
    if (refreshInterval <= 0) return;

    const timer = setInterval(() => {
      if (viewMode === 'list') {
        fetchLogs();
      } else {
        fetchMonthlyLogs();
      }
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, viewMode]);

  const fetchLogs = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const classesRes = await queryTable('student_classes');
      const cmap: Record<number, string> = {};
      classesRes.rows?.forEach((cls: any) => {
        cmap[cls.id] = cls.name;
      });
      setClassMap(cmap);

      const studentsRes = await queryTable('students');
      const studentMap = new Map((studentsRes.rows || []).map((s: any) => [s.id, s]));
      setStudents(studentsRes.rows || []);

      const targetDate = selectedDate || (() => {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      })();

      const logsRes = await executeSQL(`
        SELECT * FROM attendance_logs 
        WHERE timestamp LIKE '${targetDate}%' 
        ORDER BY id DESC
      `);

      const formattedLogs = (logsRes.rows || []).map((log: any) => {
        const student = studentMap.get(log.student_id);
        return {
          ...log,
          student_name: student?.name || `ID: ${log.student_id}`,
          parent_name: student?.parent_name || '',
          parent_phone: student?.parent_phone || '',
          class_name: student ? (cmap[student.class_id] || '') : ''
        };
      });

      setLogs(formattedLogs);
    } catch (err) {
      console.error('기록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyLogs = async () => {
    setLoading(true);
    try {
      const classesRes = await queryTable('student_classes');
      const cmap: Record<number, string> = {};
      classesRes.rows?.forEach((cls: any) => {
        cmap[cls.id] = cls.name;
      });
      setClassMap(cmap);

      const studentsRes = await queryTable('students');
      setStudents(studentsRes.rows || []);

      const logsRes = await queryTable('attendance_logs', {
        limit: 5000,
      });

      const filteredLogs = (logsRes.rows || []).filter((log: any) => {
        return log.timestamp.startsWith(selectedMonth);
      });

      const data: Record<number, Record<number, string[]>> = {};
      filteredLogs.forEach((log: any) => {
        const day = new Date(log.timestamp).getDate();
        if (!data[log.student_id]) data[log.student_id] = {};
        if (!data[log.student_id][day]) data[log.student_id][day] = [];
        if (!data[log.student_id][day].includes(log.type)) {
          data[log.student_id][day].push(log.type);
        }
      });

      setMonthlyData(data);
    } catch (err) {
      console.error('월간 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadMonthlyExcel = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // 헤더 생성
    const headers = ['관원 이름', '수련반', '등원횟수'];
    for (let i = 1; i <= daysInMonth; i++) {
      headers.push(`${i}일`);
    }

    // 데이터 생성
    const excelData = students.map(student => {
      const studentData = monthlyData[student.id] || {};
      const attendanceCount = Object.values(studentData).filter(logs => logs.includes('IN')).length;
      
      const row: any = {
        '관원 이름': student.name,
        '수련반': classMap[student.class_id] || '미배정',
        '등원횟수': attendanceCount
      };

      for (let i = 1; i <= daysInMonth; i++) {
        row[`${i}일`] = studentData[i]?.includes('IN') ? 'O' : 'X';
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '출결현황');
    
    XLSX.writeFile(workbook, `출결현황_${selectedMonth}.xlsx`);
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  let displayData = logs;
  if (filterMode === 'not_in') {
    const checkInIds = new Set(logs.filter(l => l.timestamp.startsWith(selectedDate) && l.type === 'IN').map(l => l.student_id));
    displayData = students.filter(s => (s.status === 'ACTIVE' || !s.status) && !checkInIds.has(s.id)).map(s => ({
      id: `fake-${s.id}`,
      student_id: s.id,
      timestamp: selectedDate,
      type: 'NOT_IN',
      status: '결석',
      student_name: s.name,
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
      class_name: classMap[s.class_id] || ''
    })) as any;
  } else if (filterMode === 'not_out') {
    const checkInIds = new Set(logs.filter(l => l.timestamp.startsWith(selectedDate) && l.type === 'IN').map(l => l.student_id));
    const checkOutIds = new Set(logs.filter(l => l.timestamp.startsWith(selectedDate) && l.type === 'OUT').map(l => l.student_id));
    displayData = students
      .filter(s => (s.status === 'ACTIVE' || !s.status) && checkInIds.has(s.id) && !checkOutIds.has(s.id))
      .map(s => {
        const inLog = logs.find(l => l.student_id === s.id && l.timestamp.startsWith(selectedDate) && l.type === 'IN');
        return {
          id: `fake-${s.id}`,
          student_id: s.id,
          timestamp: inLog?.timestamp || selectedDate,
          type: 'NOT_OUT',
          status: '수련 중',
          student_name: s.name,
          parent_name: s.parent_name || '',
          parent_phone: s.parent_phone || '',
          class_name: classMap[s.class_id] || ''
        };
      }) as any;
  }

  const filteredLogs = displayData.filter(log => 
    matchChosung(log.student_name || '', searchTerm) || 
    matchChosung(log.parent_name || '', searchTerm) || 
    (log.parent_phone || '').includes(searchTerm) ||
    matchChosung(log.class_name || '', searchTerm)
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredLogs.map((log: any) => log.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    const realSelectedIds = selectedIds.filter(id => typeof id === 'number') as number[];
    if (realSelectedIds.length === 0) {
      alert('삭제할 수 있는 실제 기록이 선택되지 않았습니다.');
      return;
    }
    if (!confirm(`${realSelectedIds.length}개의 기록을 삭제하시겠습니까?`)) return;

    try {
      await deleteRows('attendance_logs', { ids: realSelectedIds });
      setLogs((prev) => prev.filter((log) => !realSelectedIds.includes(log.id)));
      setSelectedIds((prev) => prev.filter(id => typeof id === 'string')); // keep fake ids selected if any
      alert('삭제되었습니다.');
    } catch (err) {
      console.error('삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;

    try {
      await deleteRows('attendance_logs', { ids: [id] });
      setLogs((prev) => prev.filter((log) => log.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      alert('삭제되었습니다.');
    } catch (err) {
      console.error('삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '40px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.05em' }}>출결 기록 관리</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }} className="group mr-2">
            <Search 
              size={16} 
              style={{ 
                position: 'absolute', 
                left: '16px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                pointerEvents: 'none',
                color: '#94A3B8'
              }} 
            />
            <input 
              type="text" 
              placeholder="관원명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                padding: '12px 24px 12px 48px', 
                backgroundColor: '#FFFFFF', 
                color: '#475569', 
                borderRadius: '16px', 
                border: '1px solid #E2E8F0', 
                fontWeight: 800, 
                fontSize: '14px', 
                width: '240px',
                outline: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                transition: 'all'
              }}
              className="focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
            />
          </div>

          <button 
            onClick={() => setViewMode('list')}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: viewMode === 'list' ? '#2563EB' : '#FFFFFF', 
              color: viewMode === 'list' ? '#FFFFFF' : '#475569', 
              borderRadius: '16px', 
              border: viewMode === 'list' ? 'none' : '1px solid #E2E8F0', 
              fontWeight: 800, 
              fontSize: '14px', 
              cursor: 'pointer', 
              boxShadow: viewMode === 'list' ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
              transition: 'all'
            }}
          >
            최근 기록
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: viewMode === 'monthly' ? '#2563EB' : '#FFFFFF', 
              color: viewMode === 'monthly' ? '#FFFFFF' : '#475569', 
              borderRadius: '16px', 
              border: viewMode === 'monthly' ? 'none' : '1px solid #E2E8F0', 
              fontWeight: 800, 
              fontSize: '14px', 
              cursor: 'pointer', 
              boxShadow: viewMode === 'monthly' ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
              transition: 'all'
            }}
          >
            월간 현황
          </button>

          {viewMode === 'list' && (
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '18px', marginLeft: '12px' }}>
              <button 
                onClick={() => setFilterMode('all')}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: filterMode === 'all' ? '#FFFFFF' : 'transparent', 
                  color: filterMode === 'all' ? '#0F172A' : '#64748B', 
                  borderRadius: '14px', 
                  border: 'none', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  boxShadow: filterMode === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all'
                }}
              >
                전체
              </button>
              <button 
                onClick={() => setFilterMode('not_in')}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: filterMode === 'not_in' ? '#FFFFFF' : 'transparent', 
                  color: filterMode === 'not_in' ? '#EF4444' : '#64748B', 
                  borderRadius: '14px', 
                  border: 'none', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  boxShadow: filterMode === 'not_in' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all'
                }}
              >
                미등원
              </button>
              <button 
                onClick={() => setFilterMode('not_out')}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: filterMode === 'not_out' ? '#FFFFFF' : 'transparent', 
                  color: filterMode === 'not_out' ? '#3B82F6' : '#64748B', 
                  borderRadius: '14px', 
                  border: 'none', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  boxShadow: filterMode === 'not_out' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all'
                }}
              >
                미하원
              </button>
            </div>
          )}

          {viewMode === 'list' && (
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#FFFFFF', 
                color: '#475569', 
                borderRadius: '16px', 
                border: '1px solid #E2E8F0', 
                fontWeight: 800, 
                fontSize: '14px', 
                cursor: 'pointer', 
                outline: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                marginLeft: '12px'
              }}
            />
          )}

          {viewMode === 'monthly' && (
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#FFFFFF', 
                color: '#475569', 
                borderRadius: '16px', 
                border: '1px solid #E2E8F0', 
                fontWeight: 800, 
                fontSize: '14px', 
                cursor: 'pointer', 
                outline: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}
            />
          )}

          {viewMode === 'list' && selectedIds.length > 0 && filterMode === 'all' && (
            <button 
              onClick={handleDeleteSelected}
              style={{ padding: '12px 24px', backgroundColor: '#FEE2E2', color: '#EF4444', borderRadius: '16px', border: '1px solid #FECACA', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
            >
              선택 삭제 ({selectedIds.filter(id => typeof id === 'number').length})
            </button>
          )}
          
          {viewMode === 'monthly' && (
            <button 
              onClick={downloadMonthlyExcel}
              style={{ padding: '12px 24px', backgroundColor: '#2563EB', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '14px', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'all' }}
            >
              <Download size={16} /> 엑셀 다운로드
            </button>
          )}

          {viewMode === 'list' && (filterMode === 'not_in' || filterMode === 'not_out') && selectedIds.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={sendSmsOnBatch}
                onChange={(e) => setSendSmsOnBatch(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3B82F6' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#475569' }}>문자 발송</span>
            </label>
          )}
          
          {viewMode === 'list' && filterMode === 'not_in' && selectedIds.length > 0 && (
            <button 
              onClick={() => {
                const targetStudentIds = filteredLogs.filter((l: any) => selectedIds.includes(l.id)).map((l: any) => l.student_id);
                handleBatchProcess('IN', targetStudentIds);
                setSelectedIds([]);
              }}
              disabled={isProcessing}
              style={{ padding: '12px 24px', backgroundColor: '#10B981', color: '#FFFFFF', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'all' }}
            >
              {isProcessing ? '처리 중...' : `선택 관원 등원 처리 (${selectedIds.length})`}
            </button>
          )}

          {viewMode === 'list' && filterMode === 'not_out' && selectedIds.length > 0 && (
            <button 
              onClick={() => {
                const targetStudentIds = filteredLogs.filter((l: any) => selectedIds.includes(l.id)).map((l: any) => l.student_id);
                handleBatchProcess('OUT', targetStudentIds);
                setSelectedIds([]);
              }}
              disabled={isProcessing}
              style={{ padding: '12px 24px', backgroundColor: '#3B82F6', color: '#FFFFFF', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)', transition: 'all' }}
            >
              {isProcessing ? '처리 중...' : `선택 관원 하원 처리 (${selectedIds.length})`}
            </button>
          )}

          <button 
            onClick={viewMode === 'list' ? fetchLogs : fetchMonthlyLogs}
            style={{ padding: '12px 24px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', fontWeight: 800, fontSize: '14px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}
          >
            <RefreshCw size={16} /> 새로고침
          </button>
        </div>
      </header>

      {viewMode === 'list' ? (
        <div className="bg-white/80 backdrop-blur-2xl rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white">
                  <th className="p-8 w-20">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-200 cursor-pointer"
                      checked={logs.length > 0 && selectedIds.length === logs.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">ID</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">날짜/시간</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">관원 성함</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">수련반</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">구분</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">상태</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">문자 발송</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-black tracking-widest text-xs uppercase">LOADING LOGS...</p>
                      </div>
                    </td>
                  </tr>
                ) : (() => {
                  if (filteredLogs.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="p-20 text-center">
                          <p className="text-xl font-black text-slate-300">해당하는 관원이 없습니다.</p>
                        </td>
                      </tr>
                    );
                  }

                  return filteredLogs.map((log: any) => (
                    <tr key={log.type === 'all' ? log.id : `${log.student_id}-${log.type}`} className={`group border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${typeof log.id === 'number' && selectedIds.includes(log.id) ? 'bg-blue-50/30' : ''}`}>
                      <td className="p-8">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-slate-200 cursor-pointer"
                          checked={selectedIds.includes(log.id)}
                          onChange={() => handleSelectOne(log.id)}
                        />
                      </td>
                      <td className="p-8 text-slate-400 font-mono text-xs">{typeof log.id !== 'number' || log.id === 0 ? '-' : log.id}</td>
                      <td className="p-8">
                        <p className="font-bold text-slate-700">{typeof log.id !== 'number' || log.id === 0 ? '기록 없음' : new Date(log.timestamp).toLocaleDateString('ko-KR')}</p>
                        <p className="text-xs font-medium text-slate-400">{typeof log.id !== 'number' || log.id === 0 ? '-' : new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour12: false })}</p>
                      </td>
                      <td className="p-8 font-black text-slate-900 text-lg">{log.student_name}</td>
                      <td className="p-8">
                        <span className="bg-blue-50 text-blue-600 font-black text-xs px-3 py-1 rounded-lg border border-blue-100">
                          {log.class_name || '미배정'}
                        </span>
                      </td>
                      <td className="p-8">
                        <span style={{ 
                          display: 'inline-block', 
                          minWidth: '60px', 
                          textAlign: 'center',
                          padding: '8px 16px',
                          borderRadius: '100px',
                          fontSize: '11px',
                          fontWeight: 900,
                          letterSpacing: '0.05em',
                          color: '#FFFFFF',
                          backgroundColor: log.type === 'IN' ? '#10B981' : log.type === 'OUT' ? '#3B82F6' : log.type === 'NOT_IN' ? '#EF4444' : '#F59E0B',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          {log.type === 'IN' ? '등원' : log.type === 'OUT' ? '하원' : log.type === 'NOT_IN' ? '미등원' : '미하원'}
                        </span>
                      </td>
                      <td className="p-8">
                        <span className="text-slate-500 font-bold text-sm tracking-tight">
                          {log.status === 'NORMAL' ? '정상' : log.status}
                        </span>
                      </td>
                      <td className="p-8 text-center">
                        {log.sms_status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black border border-green-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            발송완료
                          </span>
                        ) : log.sms_status === 'SENDING' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black border border-blue-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            발송중
                          </span>
                        ) : log.sms_status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black border border-red-100">
                            발송실패
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300">미발송</span>
                        )}
                      </td>
                      <td className="p-8 text-center">
                        {log.id !== 0 && (
                          <button
                            onClick={() => handleDelete(log.id)}
                            style={{ 
                              width: '40px', 
                              height: '40px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              backgroundColor: '#FEF2F2', 
                              color: '#EF4444', 
                              borderRadius: '12px', 
                              border: 'none', 
                              cursor: 'pointer',
                              margin: '0 auto',
                              transition: 'all'
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                            title="기록 삭제"
                          >
                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>✕</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-2xl rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col h-[70vh]">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
              <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-20 shadow-sm">
                <tr>
                  <th className="pl-4 pr-1 py-3 w-24 font-black text-[11px] text-slate-400 uppercase tracking-widest bg-white sticky left-0 z-30 border-b">관원 이름</th>
                  <th className="pl-4 pr-1 py-3 w-24 font-black text-[11px] text-slate-400 uppercase tracking-widest bg-white sticky left-[96px] z-30 border-b">수련반</th>
                  <th className="p-2 w-[60px] text-center font-black text-[11px] text-slate-400 uppercase tracking-widest bg-white sticky left-[192px] z-30 border-b">통계</th>
                  {daysArray.map(day => {
                    const date = new Date(year, month - 1, day);
                    const dayOfWeek = date.getDay(); // 0: Sun, 6: Sat
                    const isHoliday = [
                      '01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'
                    ].includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                    
                    let textColor = '#94A3B8';
                    let bgColor = '';
                    if (dayOfWeek === 6) {
                      textColor = '#3B82F6';
                      bgColor = 'bg-blue-50/30';
                    }
                    if (dayOfWeek === 0 || isHoliday) {
                      textColor = '#EF4444';
                      bgColor = 'bg-red-50/30';
                    }

                    return (
                      <th key={day} className={`p-1 text-center border-b border-slate-50 ${bgColor}`}>
                        <div style={{ color: textColor }} className="font-black text-[11px]">{day}</div>
                        <div style={{ color: textColor, opacity: 0.5 }} className="text-[8px] font-medium">
                          {['일','월','화','수','목','금','토'][dayOfWeek]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={daysInMonth + 3} className="p-40 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-black tracking-widest text-xs uppercase">ANALYZING MONTHLY DATA...</p>
                      </div>
                    </td>
                  </tr>
                ) : students.filter(s => 
                    matchChosung(s.name || '', searchTerm) || 
                    matchChosung(s.parent_name || '', searchTerm) || 
                    (s.parent_phone || '').includes(searchTerm) ||
                    matchChosung(classMap[s.class_id] || '', searchTerm)
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 3} className="p-20 text-center">
                      <p className="text-xl font-black text-slate-300">등록된 관원이 없습니다.</p>
                    </td>
                  </tr>
                ) : (
                  students.filter(s => 
                    matchChosung(s.name || '', searchTerm) || 
                    matchChosung(s.parent_name || '', searchTerm) || 
                    (s.parent_phone || '').includes(searchTerm) ||
                    matchChosung(classMap[s.class_id] || '', searchTerm)
                  ).map(student => {
                    const studentData = monthlyData[student.id] || {};
                    const attendanceCount = Object.values(studentData).filter(logs => logs.includes('IN')).length;

                    return (
                      <tr key={student.id} className="hover:bg-blue-50/80 transition-colors border-b border-slate-50 group">
                        <td className="pl-4 pr-1 py-3 font-black text-slate-900 sticky left-0 bg-white z-10 sticky-column">{student.name}</td>
                        <td className="pl-4 pr-1 py-3 sticky left-[96px] bg-white z-10 sticky-column">
                          <span className="text-[10px] font-bold text-blue-600">
                            {classMap[student.class_id] || '미배정'}
                          </span>
                        </td>
                        <td className="p-2 text-center sticky left-[192px] bg-white z-10 font-black text-sm sticky-column" style={{ color: '#10B981' }}>
                          {attendanceCount}
                        </td>
                        {daysArray.map(day => {
                          const date = new Date(year, month - 1, day);
                          const today = new Date();
                          const isToday = date.getFullYear() === today.getFullYear() && 
                                          date.getMonth() === today.getMonth() && 
                                          date.getDate() === today.getDate();
                          const isFuture = date > today;
                          
                          const dayOfWeek = date.getDay();
                          const isHoliday = [
                            '01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'
                          ].includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

                          let bgColor = '';
                          if (isToday) bgColor = 'bg-yellow-50/50';
                          else if (dayOfWeek === 6) bgColor = 'bg-blue-50/30';
                          else if (dayOfWeek === 0 || isHoliday) bgColor = 'bg-red-50/30';

                          const logs = studentData[day] || [];
                          const hasIn = logs.includes('IN');

                          return (
                            <td key={day} className={`p-0.5 border-r border-slate-50 ${bgColor} transition-colors ${isToday ? 'ring-1 ring-inset ring-yellow-200/50' : ''}`}>
                              <div className="flex items-center justify-center">
                                {hasIn ? (
                                  <span style={{ color: '#10B981' }} className="font-black text-sm">O</span>
                                ) : isFuture ? (
                                  <span className="text-slate-300 font-bold text-sm opacity-40">-</span>
                                ) : (
                                  <span style={{ color: '#EF4444' }} className="font-medium text-sm opacity-20">X</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 10px;
          border: 2px solid #F1F5F9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
        .sticky-column {
          transition: all 0.2s;
        }
        tr:hover .sticky-column {
          background-color: #EFF6FF !important;
        }
        tr:hover td {
          background-color: #EFF6FF !important;
          border-color: #DBEAFE !important;
        }
      `}</style>
    </div>
  );
}
