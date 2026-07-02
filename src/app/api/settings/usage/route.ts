import { NextResponse } from 'next/server';
import { executeSQL, createTable } from '@root/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 테이블이 없다면 생성 (초기 안정성 확보)
    try {
      await createTable('사용량 통계 로그', [
        { name: 'type', type: 'TEXT', notNull: true },
        { name: 'timestamp', type: 'TEXT', notNull: true },
        { name: 'student_id', type: 'INTEGER' }
      ], { tableName: 'tkd_usage_logs' });
    } catch (err: any) {
      if (err.message && !err.message.includes('UNIQUE constraint failed') && !err.message.includes('already exists')) {
        console.warn('사용량 통계 테이블 생성 중 경고:', err.message);
      }
    }

    // 2. 현재 달 구하기 (한국 시간 기준)
    const now = new Date();
    const currentMonth = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 7); // 예: '2026-05'
    
    // 3. 이번 달 통계 쿼리 실행
    let res: any = { rows: [] };
    try {
      res = await executeSQL(`
        SELECT type, count(*) as count 
        FROM tkd_usage_logs 
        WHERE timestamp LIKE '${currentMonth}%'
        GROUP BY type
      `);
    } catch (err: any) {
      if (err.message && err.message.includes('no such table')) {
        console.warn('사용량 통계 테이블이 아직 준비되지 않았습니다. 0으로 반환합니다.');
      } else {
        throw err;
      }
    }

    let faceCount = 0;
    let smsCount = 0;

    if (res.rows) {
      for (const row of res.rows) {
        if (row.type === 'FACE') faceCount = row.count;
        if (row.type === 'SMS') smsCount = row.count;
      }
    }

    return NextResponse.json({ success: true, faceCount, smsCount, currentMonth });
  } catch (error: any) {
    console.error('Failed to fetch usage stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
