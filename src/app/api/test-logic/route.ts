import { NextResponse } from 'next/server';
import { executeSQL, queryTable } from '@root/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date();
    const tzOffset = 9 * 60 * 60000;
    const localDate = new Date(today.getTime() + tzOffset);
    const todayStr = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`;

    const logsRes = await executeSQL(`
      SELECT * FROM attendance_logs 
      WHERE timestamp LIKE '${todayStr}%' 
      ORDER BY id DESC
    `);
    
    const studentsRes = await queryTable('students', { orderBy: 'id', orderDirection: 'DESC' });

    return NextResponse.json({ 
      success: true, 
      todayStr,
      logsLength: logsRes?.rows?.length,
      studentsLength: studentsRes?.rows?.length,
      logsRows: logsRes?.rows,
      studentsResType: typeof studentsRes,
      studentsResKeys: studentsRes ? Object.keys(studentsRes) : []
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
