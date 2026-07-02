import { NextResponse } from 'next/server';
import { executeSQL, createTable } from '@root/egdesk-helpers';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // 선택적: 특정 월을 다운받고 싶다면 ?month=2026-05 처럼 넘길 수 있음. 없으면 전체.
    const targetMonth = searchParams.get('month');
    
    // 다운로드 시점에도 테이블이 없을 수 있으므로 안전을 위해 생성 시도
    try {
      await createTable('사용량 통계 로그', [
        { name: 'type', type: 'TEXT', notNull: true },
        { name: 'timestamp', type: 'TEXT', notNull: true },
        { name: 'student_id', type: 'INTEGER' }
      ], { tableName: 'tkd_usage_logs' });
    } catch (e) {
      // 이미 존재하면 무시됨
    }
    
    let query = `
      SELECT 
        l.type as '구분', 
        l.timestamp as '발생시간', 
        s.name as '관원명',
        s.parent_phone as '학부모연락처'
      FROM tkd_usage_logs l
      LEFT JOIN students s ON l.student_id = s.id
    `;

    if (targetMonth) {
      query += ` WHERE l.timestamp LIKE '${targetMonth}%'`;
    }
    
    query += ` ORDER BY l.timestamp DESC`;

    let logs = [];
    try {
      const res = await executeSQL(query);
      logs = res.rows || [];
    } catch (err: any) {
      if (err.message && err.message.includes('no such table')) {
        // 테이블이 갓 생성되어 동기화가 안 되었거나 데이터가 없는 경우
        logs = [];
      } else {
        throw err;
      }
    }

    // 데이터를 읽기 쉽게 가공
    const formattedLogs = logs.map((row: any) => ({
      ...row,
      '구분': row['구분'] === 'FACE' ? '얼굴인식 출결' : (row['구분'] === 'SMS' ? '문자 알림 발송' : row['구분'])
    }));

    // 엑셀 파일 생성
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(formattedLogs);
    
    // 열 너비 조절
    ws['!cols'] = [
      { wch: 15 }, // 구분
      { wch: 22 }, // 발생시간
      { wch: 12 }, // 관원명
      { wch: 15 }  // 학부모연락처
    ];

    xlsx.utils.book_append_sheet(wb, ws, "과금용_사용량로그");
    
    // 버퍼로 변환
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // 파일 다운로드 헤더 설정
    const filename = `usage_logs_${targetMonth || 'all'}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('엑셀 다운로드 실패:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
