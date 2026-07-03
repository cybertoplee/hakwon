import { NextResponse } from 'next/server';
import { queryTable, executeSQL } from '@root/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const [studentsRes, countRes, logsRes, settingsRes] = await Promise.all([
      queryTable('students', { limit: 1000 }),
      executeSQL(`SELECT COUNT(*) as count FROM attendance_logs WHERE timestamp LIKE '${todayStr}%' AND type = 'IN'`),
      executeSQL(`SELECT student_id, timestamp, type FROM attendance_logs WHERE timestamp LIKE '${todayStr}%' ORDER BY timestamp DESC LIMIT 5`),
      queryTable('tkd_system_settings').catch(() => null)
    ]);

    return NextResponse.json({
      students: studentsRes?.rows || [],
      count: countRes?.rows?.[0]?.count || 0,
      logs: logsRes?.rows || [],
      settings: settingsRes?.rows || []
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });

  } catch (error: any) {
    console.error('Error in attendance_init API:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
