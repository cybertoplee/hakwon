import { NextResponse } from 'next/server';
import { queryBankTransactions, queryTable, insertRows, callAICenterTool } from '@root/egdesk-helpers';

export async function GET() {
  try {
    // 1. 은행 거래 내역 가져오기 (최근 7일)
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const bankData = await queryBankTransactions({
      startDate: lastWeek.toISOString().split('T')[0],
      limit: 100
    });

    const transactions = bankData.rows || [];
    const incomingDeposits = transactions.filter((t: any) => t.amount > 0 && t.type === 'deposit');

    if (incomingDeposits.length === 0) {
      return NextResponse.json({ success: true, message: '새로운 입금 내역이 없습니다.' });
    }

    // 2. 학생/학부모 명단 가져오기
    const studentData = await queryTable('students');
    const students = studentData.rows || [];

    // 3. AI 매칭 로직 (Gemini 활용)
    // 여기서는 callAICenterTool을 사용하여 AI에게 매칭을 요청하는 시나리오를 시뮬레이션하거나
    // 직접적인 프롬프트 엔지니어링을 적용할 수 있습니다.
    
    const results = [];
    for (const deposit of incomingDeposits) {
      const prompt = `
        다음 입금 내역을 수강생 명단과 대조하여 가장 일치하는 학생을 찾아주세요.
        입금자명: ${deposit.description}
        입금액: ${deposit.amount}
        
        수강생 명단:
        ${students.map((s: any) => `- ID: ${s.id}, 이름: ${s.name}, 학부모: ${s.parent_name}`).join('\n')}
        
        결과를 JSON 형식으로 반환하세요: { "matched_student_id": number | null, "confidence": number, "reason": string }
      `;

      // AI 센터 도구를 통해 분석 요청 (실제 환경에 맞는 도구 호출)
      // 여기서는 예시로 로직을 구현합니다.
      const aiResponse = await callAICenterTool('ai_center_process_text', { 
        text: prompt,
        task: 'payment_matching'
      });

      if (aiResponse && aiResponse.matched_student_id) {
        // DB에 수납 기록 저장
        await insertRows('payment_records', [{
          student_id: aiResponse.matched_student_id,
          amount: deposit.amount,
          payment_date: deposit.date,
          depositor_name: deposit.description,
          status: 'MATCHED'
        }]);
        results.push({ deposit: deposit.description, matched: true, studentId: aiResponse.matched_student_id });
      } else {
        // 매칭 실패 시 미확인 기록으로 저장
        await insertRows('payment_records', [{
          amount: deposit.amount,
          payment_date: deposit.date,
          depositor_name: deposit.description,
          status: 'UNMATCHED'
        }]);
        results.push({ deposit: deposit.description, matched: false });
      }
    }

    return NextResponse.json({ success: true, processedCount: incomingDeposits.length, results });
  } catch (error: any) {
    console.error('Payment sync failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
