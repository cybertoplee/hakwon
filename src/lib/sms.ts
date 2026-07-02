import { queryTable, executeSQL, updateRows, insertRows } from '@root/egdesk-helpers';
import { gmAutomation } from '@/lib/google-messages';
import fs from 'fs';
import path from 'path';

// Obfuscate path to prevent Next.js Turbopack from statically analyzing and bundling the storage directory
const STORAGE_DIR = ['s', 't', 'o', 'r', 'a', 'g', 'e'].join('');
const LOG_FILE = path.join(process.cwd(), STORAGE_DIR, 'sms-log.txt');
const DEBUG_FILE = path.join(process.cwd(), STORAGE_DIR, 'DEBUG_SMS.txt');

function logToFile(message: string) {
  const timestamp = new Date().toLocaleString('ko-KR');
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    const storageDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (err) {
    console.error('로그 파일 기록 실패:', err);
  }
}

/**
 * 학생 출결 알림 문자 발송
 */
export async function sendAttendanceSMS(studentId: number, type: 'IN' | 'OUT') {
  try {
    // 디버그용 즉시 쓰기
    const storageDir = path.dirname(DEBUG_FILE);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(DEBUG_FILE, `CALLED at ${new Date().toISOString()}`);
    
    logToFile(`[시작] 학생 ID: ${studentId}, 타입: ${type}`);

    // 1. 시스템 설정 가져오기
    const settingsRes = await queryTable('tkd_system_settings');
    const settings = settingsRes.rows || [];
    
    const smsEnabledEntry = settings.find((s: any) => s.key === 'sms_enabled');
    logToFile(`[설정 확인] sms_enabled 값: ${smsEnabledEntry?.value}`);

    const isEnabled = smsEnabledEntry?.value === 'true' || smsEnabledEntry?.value === 'ON';
    if (!isEnabled) {
      logToFile(`[중단] SMS 발송 설정이 꺼져 있습니다. (현재값: ${smsEnabledEntry?.value})`);
      return { success: false, error: 'SMS 발송 설정이 비활성화 상태입니다.' };
    }

    const templateIn = settings.find((s: any) => s.key === 'sms_template_in')?.value || '[EG태권도] {name} 학생이 {time}에 등원하였습니다.';
    const templateOut = settings.find((s: any) => s.key === 'sms_template_out')?.value || '[EG태권도] {name} 학생이 {time}에 하원하였습니다.';
    
    // 2. 학생 및 학부모 정보 가져오기
    const studentRes = await executeSQL(`SELECT name, parent_phone, parent_name FROM students WHERE id = ${studentId}`);
    const student = studentRes.rows?.[0];
    
    if (!student) {
      logToFile(`[에러] 학생 정보를 찾을 수 없습니다. (ID: ${studentId})`);
      return { success: false, error: `학생 정보를 찾을 수 없습니다. (ID: ${studentId})` };
    }

    if (!student.parent_phone) {
      logToFile(`[중단] 학부모 연락처가 없습니다. (학생: ${student.name})`);
      return { success: false, error: `학부모 연락처가 없습니다. (학생: ${student.name})` };
    }

    // 3. 메시지 치환
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const template = type === 'IN' ? templateIn : templateOut;
    
    const message = template
      .replace('{name}', student.name)
      .replace('{parent}', student.parent_name || '학부모님')
      .replace('{time}', timeStr);

    logToFile(`[준비] 수신처: ${student.parent_phone}, 내용: ${message}`);

    // 4. Google 메시지 웹 자동화 발송
    const result = await gmAutomation.sendSMS(student.parent_phone, message);

    // 5. 결과 기록 (가장 최근의 해당 학생 출결 로그 업데이트)
    try {
      const lastLogRes = await executeSQL(`
        SELECT id FROM attendance_logs 
        WHERE student_id = ${studentId} AND type = '${type}'
        ORDER BY timestamp DESC LIMIT 1
      `);
      const status = result.success ? 'SUCCESS' : 'FAILED';
      
      if (lastLogRes.rows && lastLogRes.rows.length > 0) {
        const logId = lastLogRes.rows[0].id;
        await updateRows('attendance_logs', { sms_status: status }, { ids: [logId] });
        logToFile(`[DB 업데이트] 학생 ${studentId} (${type}) 상태: ${status} (logId: ${logId})`);
      } else {
        logToFile(`[DB 업데이트 경고] 학생 ${studentId}의 ${type} 출결 기록을 찾을 수 없습니다.`);
      }
    } catch (dbErr: any) {
      logToFile(`[DB 업데이트 에러] ${dbErr.message}`);
    }

    if (result.success) {
      logToFile(`[성공] 발송 완료 (${student.parent_phone})`);
    } else {
      logToFile(`[실패] 발송 에러: ${result.error}`);
    }

    return result;
  } catch (err: any) {
    logToFile(`[치명적 에러] ${err.message || err}`);
    console.error('[SMS] 발송 처리 중 오류 발생:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 출결 기록 DB 저장 (즉시 응답용)
 */
export async function createAttendanceLogs(requests: { studentId: number, type: 'IN' | 'OUT' }[], timestamp: string) {
  try {
    const logRows = requests.map(req => ({
      student_id: req.studentId,
      type: req.type,
      timestamp: timestamp,
      status: 'NORMAL',
      sms_status: 'SENDING'
    }));
    
    await insertRows('attendance_logs', logRows);
    logToFile(`[DB 저장] ${requests.length}건 기록 완료 (타임스탬프: ${timestamp})`);
    return { success: true };
  } catch (err: any) {
    logToFile(`[DB 저장 에러] ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 여러 명의 학생에게 일괄 출결 알림 문자 발송
 */
export async function sendAttendanceSMSBatch(requests: { studentId: number, type: 'IN' | 'OUT' }[], timestamp?: string) {
  if (requests.length === 0) return { success: true, count: 0 };
  
  try {
    const ts = timestamp || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
    logToFile(`[배치 시작] 총 ${requests.length}건 발송 프로세스 시작`);

    // 2. 공통 설정 및 브라우저 초기화
    const settingsRes = await queryTable('tkd_system_settings');
    const settings = settingsRes.rows || [];
    
    const isEnabled = settings.find((s: any) => s.key === 'sms_enabled')?.value === 'true' || 
                      settings.find((s: any) => s.key === 'sms_enabled')?.value === 'ON';
    
    if (!isEnabled) {
      logToFile('[배치 중단] SMS 발송 설정이 꺼져 있습니다.');
      return { success: false, error: 'SMS disabled' };
    }

    const templateIn = settings.find((s: any) => s.key === 'sms_template_in')?.value || '[EG태권도] {name} 학생이 {time}에 등원하였습니다.';
    const templateOut = settings.find((s: any) => s.key === 'sms_template_out')?.value || '[EG태권도] {name} 학생이 {time}에 하원하였습니다.';

    // 브라우저 1회 초기화
    await gmAutomation.init(true);
    
    let successCount = 0;
    
    for (const req of requests) {
      try {
        const { studentId, type } = req;
        
        // 학생 정보 조회
        const studentRes = await executeSQL(`SELECT name, parent_phone, parent_name FROM students WHERE id = ${studentId}`);
        const student = studentRes.rows?.[0];
        
        if (!student || !student.parent_phone) {
          logToFile(`[배치/스킵] 학생 정보 또는 번호 없음 (ID: ${studentId})`);
          continue;
        }

        // 메시지 생성
        const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        const message = (type === 'IN' ? templateIn : templateOut)
          .replace('{name}', student.name)
          .replace('{parent}', student.parent_name || '학부모님')
          .replace('{time}', timeStr);

        // 발송
        const result = await gmAutomation.sendSMS(student.parent_phone, message);
        
        // 결과 DB 반영
        const status = result.success ? 'SUCCESS' : 'FAILED';
        const lastLogRes = await executeSQL(`
          SELECT id FROM attendance_logs 
          WHERE student_id = ${studentId} AND type = '${type}'
          ORDER BY id DESC LIMIT 1
        `);
        if (lastLogRes.rows && lastLogRes.rows.length > 0) {
          await updateRows('attendance_logs', { sms_status: status }, { ids: [lastLogRes.rows[0].id] });
        }

        if (result.success) {
          successCount++;
          // 과금용 사용량 통계 로깅 (문자 발송 건수 증가)
          const localISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19);
          await insertRows('tkd_usage_logs', [{
            type: 'SMS',
            timestamp: localISO,
            student_id: studentId
          }]).catch(e => logToFile(`[사용량 로깅 에러] ${e.message}`));
        }
        
        // 연속 발송 사이 짧은 대기 (안정성)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (err: any) {
        logToFile(`[배치/에러] 개별 발송 중 오류: ${err.message}`);
      }
    }

    logToFile(`[배치 종료] 완료: ${successCount}/${requests.length}`);
    return { success: true, count: successCount };

  } catch (err: any) {
    logToFile(`[배치 치명적 에러] ${err.message}`);
    return { success: false, error: err.message };
  }
}
