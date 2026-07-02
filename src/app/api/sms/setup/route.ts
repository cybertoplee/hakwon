import { NextResponse } from 'next/server';
import { gmAutomation } from '@/lib/google-messages';

/**
 * Google 메시지 연동 설정 API
 * 호출 시 서버에서 헤드풀 브라우저를 열어 QR 코드 스캔 대기
 */
export async function GET() {
  try {
    const result = await gmAutomation.setupConnection();
    if (result.success) {
      return NextResponse.json({ message: '연동 성공' });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
