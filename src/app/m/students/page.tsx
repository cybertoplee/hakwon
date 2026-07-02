import React from 'react';
import { queryTable } from '@root/egdesk-helpers';
import ClientStudents from './ClientStudents';

import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function MobileStudentsPage() {
  noStore();
  let initialStudents = [];
  let error = null;

  try {
    const { executeSQL } = await import('@root/egdesk-helpers');
    
    // Fetch students with class name and latest attendance
    const sql = `
      SELECT 
        s.*, 
        c.name as class_name,
        (SELECT MAX(timestamp) FROM attendance_logs WHERE student_id = s.id AND type = 'IN') as last_attendance
      FROM students s
      LEFT JOIN student_classes c ON s.class_id = c.id
      ORDER BY s.id DESC
    `;
    
    const res = await executeSQL(sql);
    initialStudents = res.rows || [];
    
    if (!res.rows) {
      console.error('DEBUG: res.rows is undefined! res is:', res);
      error = '디버그: res.rows가 없습니다.';
    }

  } catch (err: any) {
    console.error('Failed to fetch students for mobile page:', err);
    error = '데이터를 불러오는 중 오류가 발생했습니다.';
  }

  return <ClientStudents initialStudents={initialStudents} error={error} />;
}
