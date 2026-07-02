'use client';
import { useState } from 'react';
import { sendAttendanceSMSAction } from '../actions/sms';

export default function TestSMSPage() {
  const [status, setStatus] = useState('Ready');
  const [studentId, setStudentId] = useState('1');

  const handleTest = async () => {
    setStatus('Sending...');
    try {
      const res = await sendAttendanceSMSAction(Number(studentId), 'IN');
      setStatus(`Result: ${JSON.stringify(res)}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="p-10 font-sans">
      <h1 className="text-2xl font-black mb-6">SMS 발송 테스트</h1>
      <div className="flex gap-4 items-center mb-6">
        <label className="font-bold">학생 ID:</label>
        <input 
          type="number" 
          value={studentId} 
          onChange={(e) => setStudentId(e.target.value)}
          className="border p-2 rounded"
        />
      </div>
      <button 
        onClick={handleTest}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all"
      >
        테스트 문자 발송
      </button>
      <div className="mt-10 p-6 bg-slate-100 rounded-xl">
        <h2 className="font-bold mb-2">상태:</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm">{status}</pre>
      </div>
    </div>
  );
}
