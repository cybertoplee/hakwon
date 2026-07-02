import React from 'react';
import { executeSQL, queryTable } from '@root/egdesk-helpers';
import ClientAttendanceLogs from './ClientAttendanceLogs';

import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function MobileAttendancePage({ searchParams }: { searchParams: Promise<{ mode?: string, month?: string, year?: string, date?: string }> }) {
  noStore();
  const sp = await searchParams;
  const mode = sp.mode || 'daily';
  let formattedLogs = [];
  let allStudents = [];
  let queryDatePattern = '';
  let error = null;

  try {
    const classesRes = await queryTable('student_classes');
    const cmap: Record<number, string> = {};
    if (classesRes && classesRes.rows) {
      classesRes.rows.forEach((cls: any) => {
        cmap[cls.id] = cls.name;
      });
    }

    const studentsRes = await queryTable('students');
    allStudents = (studentsRes?.rows || []).map((s: any) => ({
      ...s,
      class_name: cmap[s.class_id] || ''
    }));
    const studentMap = new Map<number, any>(allStudents.map((s: any) => [s.id, s]));

    const today = new Date();
    const tzOffset = 9 * 60 * 60000; // Korea
    const localToday = new Date(today.getTime() + tzOffset);
    
    queryDatePattern = '';
    if (mode === 'monthly') {
      const year = sp.year || localToday.getUTCFullYear().toString();
      const month = sp.month || String(localToday.getUTCMonth() + 1).padStart(2, '0');
      queryDatePattern = `${year}-${month}`;
    } else {
      queryDatePattern = sp.date || `${localToday.getUTCFullYear()}-${String(localToday.getUTCMonth() + 1).padStart(2, '0')}-${String(localToday.getUTCDate()).padStart(2, '0')}`;
    }

    const logsRes = await executeSQL(`
      SELECT * FROM attendance_logs 
      WHERE timestamp LIKE '${queryDatePattern}%' 
      ORDER BY id DESC
    `);
    const logs = logsRes?.rows || [];
    
    formattedLogs = logs.map((log: any) => {
      const student = studentMap.get(log.student_id);
      return {
        ...log,
        student_name: student?.name || `ID: ${log.student_id}`,
        class_name: student?.class_name || '',
        parent_phone: student?.parent_phone || '',
        profile_image: student?.profile_image || null
      };
    });

    // In monthly mode, we only want to show students who are ACTIVE or had at least one log in this month
    if (mode === 'monthly') {
      const attendedIds = new Set(formattedLogs.map(l => l.student_id));
      allStudents = allStudents.filter(s => (s.status === 'ACTIVE' || !s.status) || attendedIds.has(s.id));
    }

    // Sort by id DESC for daily view
    if (mode === 'daily') {
      formattedLogs.sort((a: any, b: any) => b.id - a.id);
    }

  } catch (err: any) {
    console.error('Failed to fetch attendance logs for mobile page:', err);
    error = '데이터를 불러오는 중 오류가 발생했습니다.';
  }

  return <ClientAttendanceLogs key={`${mode}-${queryDatePattern}`} initialLogs={formattedLogs} allStudents={allStudents} error={error} />;
}
