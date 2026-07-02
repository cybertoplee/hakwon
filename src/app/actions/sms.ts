'use server';

import { sendAttendanceSMS, sendAttendanceSMSBatch } from '../../lib/sms';
import fs from 'fs';
import path from 'path';

/**
 * 학부모 알림 문자 발송 서버 액션
 * 클라이언트 컴포넌트에서 안전하게 호출할 수 있습니다.
 */
export async function sendAttendanceSMSAction(studentId: number, type: 'IN' | 'OUT') {
  try {
    // Obfuscate path to prevent Next.js Turbopack from statically analyzing and bundling the storage directory
    const STORAGE_DIR = ['s', 't', 'o', 'r', 'a', 'g', 'e'].join('');
    const storageDir = path.join(process.cwd(), STORAGE_DIR);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(path.join(storageDir, 'ACTION_CALLED.txt'), `Action invoked for student ${studentId} at ${new Date().toISOString()}`);
    return await sendAttendanceSMS(studentId, type);
  } catch (err) {
    console.error('[Server Action] SMS 발송 오류:', err);
    return { success: false, error: '서버 액션 실행 중 오류 발생' };
  }
}

/**
 * 출결 기록 DB 저장 서버 액션 (즉시 응답용)
 */
export async function createAttendanceLogsAction(requests: { studentId: number, type: 'IN' | 'OUT' }[], timestamp: string) {
  try {
    const { createAttendanceLogs } = await import('../../lib/sms');
    return await createAttendanceLogs(requests, timestamp);
  } catch (err) {
    console.error('[Server Action] 출결 기록 저장 오류:', err);
    return { success: false, error: '저장 중 오류 발생' };
  }
}

/**
 * 학부모 알림 문자 일괄 발송 서버 액션 (백그라운드용)
 */
export async function sendAttendanceSMSBatchAction(requests: { studentId: number, type: 'IN' | 'OUT' }[], timestamp?: string) {
  try {
    const { sendAttendanceSMSBatch } = await import('../../lib/sms');
    // 이제 이 함수는 DB 저장을 중복으로 하지 않도록 수정할 것입니다.
    return await sendAttendanceSMSBatch(requests, timestamp);
  } catch (err) {
    console.error('[Server Action] SMS 일괄 발송 오류:', err);
    return { success: false, error: '서버 액션 실행 중 오류 발생' };
  }
}
