'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Camera, Loader2, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react';
import Link from 'next/link';

export default function ClientEditForm({ student, classes, customFields, error }: { student: any, classes: any[], customFields: any[], error?: string | null }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceVector, setFaceVector] = useState<string>(student.face_vector || '');
  const [profileImage, setProfileImage] = useState<string>(student.profile_image || '');
  const [processStatus, setProcessStatus] = useState<string>('AI 엔진 대기중...');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelError, setModelError] = useState<string>('');

  // Form states for local control of checkboxes
  const [smsIn, setSmsIn] = useState(student.receive_sms_in === 'true' || student.receive_sms_in === true);
  const [smsOut, setSmsOut] = useState(student.receive_sms_out === 'true' || student.receive_sms_out === true);
  const [currentStatus, setCurrentStatus] = useState(student.status || 'ACTIVE');

  useEffect(() => {
    const loadFaceApi = async () => {
      try {
        setProcessStatus('AI 엔진 로드중...');
        if (!(window as any).faceapi) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/js/face-api.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load face-api.js'));
            document.body.appendChild(script);
          });
        }

        setProcessStatus('AI 모델 로드중...');
        const faceapi = (window as any).faceapi;
        const MODEL_URL = '/models/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        
        setIsModelLoaded(true);
        setProcessStatus('AI 얼굴 인식 준비 완료');
      } catch (err: any) {
        console.error('Face API load error:', err);
        setModelError('AI 엔진을 불러올 수 없습니다.');
      }
    };

    loadFaceApi();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif') {
      alert('HEIC 포맷은 지원하지 않습니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!isModelLoaded) {
      alert('AI 모델 로딩 중입니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setProcessStatus('사진 분석 중...');

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = new window.Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const MAX_SIZE = 800;
      let width = img.width;
      let height = img.height;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE; }
        else { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE; }
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) tempCtx.drawImage(img, 0, 0, width, height);

      const faceapi = (window as any).faceapi;
      const detections = await faceapi
        .detectSingleFace(tempCanvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        alert('얼굴을 인식하지 못했습니다.');
        setIsProcessing(false);
        setProcessStatus('인식 실패');
        return;
      }

      setFaceVector(JSON.stringify(Array.from(detections.descriptor)));
      const canvas = document.createElement('canvas');
      const box = detections.detection.box;
      const padding = box.width * 0.3;
      let sx = Math.max(0, box.x - padding);
      let sy = Math.max(0, box.y - padding);
      let size = Math.min(tempCanvas.width - sx, tempCanvas.height - sy, box.width + padding * 2);

      canvas.width = 150;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(tempCanvas, sx, sy, size, size, 0, 0, 150, 150);
        setProfileImage(canvas.toDataURL('image/jpeg', 0.8));
      }
      setProcessStatus('분석 완료!');
    } catch (err) {
      console.error(err);
      alert('오류 발생');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pt-safe pb-24">
      <header className="bg-white/80 backdrop-blur-xl px-4 py-3 sticky top-0 z-10 shadow-sm border-b border-slate-200/50 flex items-center gap-3">
        <Link href="/m/students" className="p-2 -ml-2 text-slate-400 hover:text-slate-700 bg-slate-100/50 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">정보 수정</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {error && (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-2xl flex items-start gap-3 border border-amber-100">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 mt-2 cursor-pointer" onClick={() => !isProcessing && isModelLoaded && fileInputRef.current?.click()}>
            <div className={`w-full h-full rounded-full flex flex-col items-center justify-center border-4 overflow-hidden transition-all duration-300 ${profileImage ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-slate-100 bg-slate-50 border-dashed hover:bg-slate-100 hover:border-slate-300'}`}>
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={32} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-400">사진 변경</span>
                </>
              )}
            </div>
            {profileImage && (
              <div className="absolute bottom-0 right-0 bg-green-500 text-white rounded-full p-1.5 border-4 border-white pointer-events-none z-10 shadow-sm">
                <CheckCircle2 size={16} strokeWidth={3} />
              </div>
            )}
          </div>
          
          <input type="file" ref={fileInputRef} accept="image/*" capture="user" className="hidden" onChange={handleFileChange} disabled={!isModelLoaded || isProcessing} />
          
          <div className="text-xs font-semibold">
            {isModelLoaded ? (
              <span className="text-green-600 bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-1.5"><CheckCircle2 size={14}/> AI 인식 엔진 준비 완료</span>
            ) : (
              <span className="text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> {processStatus}</span>
            )}
          </div>
        </div>

        <form action="/api/mobile_edit_post" method="POST" className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
          <input type="hidden" name="id" value={student.id} />
          <input type="hidden" name="face_vector" value={faceVector} />
          <input type="hidden" name="profile_image" value={profileImage} />

          <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">관원 이름 *</label>
              <input type="text" name="name" defaultValue={student.name} required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">생년월일</label>
              <input type="text" name="birth_date" defaultValue={student.birth_date} placeholder="YYYY-MM-DD" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">학부모 성함</label>
              <input type="text" name="parent_name" defaultValue={student.parent_name} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">학부모 연락처</label>
              <input type="tel" name="parent_phone" defaultValue={student.parent_phone} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">수련반 선택</label>
              <select name="class_id" defaultValue={student.class_id} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none">
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">급/단</label>
              <input type="text" name="rank" defaultValue={student.rank} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">알림 문자 설정</label>
              <div className="flex gap-2">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${smsIn ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                  <input type="checkbox" checked={smsIn} onChange={e => setSmsIn(e.target.checked)} className="hidden" />
                  <input type="hidden" name="receive_sms_in" value={smsIn ? 'true' : 'false'} />
                  {smsIn ? <CheckCircle2 size={18} className="text-blue-600" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300" />}
                  <span className={`text-sm font-bold ${smsIn ? 'text-blue-700' : 'text-slate-500'}`}>등원 알림</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${smsOut ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                  <input type="checkbox" checked={smsOut} onChange={e => setSmsOut(e.target.checked)} className="hidden" />
                  <input type="hidden" name="receive_sms_out" value={smsOut ? 'true' : 'false'} />
                  {smsOut ? <CheckCircle2 size={18} className="text-blue-600" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300" />}
                  <span className={`text-sm font-bold ${smsOut ? 'text-blue-700' : 'text-slate-500'}`}>하원 알림</span>
                </label>
              </div>
            </div>

            {customFields.map(field => (
              <div key={field.id} className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-800 ml-1">{field.display_name}</label>
                <input type="text" name={field.field_name} defaultValue={student[field.field_name] || ''} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">메모</label>
              <textarea name="memo" rows={3} defaultValue={student.memo} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none" />
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <label className="text-sm font-bold text-slate-800 ml-1">관원 상태 관리</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="hidden" name="status" value={currentStatus} />
                
                {currentStatus === 'ACTIVE' ? (
                  <>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (confirm('휴관 처리하시겠습니까?')) {
                          setCurrentStatus('ON_HOLD');
                        }
                      }}
                      className="bg-amber-50 text-amber-600 border border-amber-200 py-3 rounded-2xl font-bold text-sm shadow-sm active:scale-95 transition-all"
                    >
                      휴관 처리
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (confirm('퇴관 처리하시겠습니까?')) {
                          setCurrentStatus('DISCHARGED');
                        }
                      }}
                      className="bg-red-50 text-red-600 border border-red-200 py-3 rounded-2xl font-bold text-sm shadow-sm active:scale-95 transition-all"
                    >
                      퇴관 처리
                    </button>
                  </>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => {
                      if (confirm('재원 상태로 복관 처리하시겠습니까?')) {
                        setCurrentStatus('ACTIVE');
                      }
                    }}
                    className="col-span-2 bg-green-50 text-green-600 border border-green-200 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                  >
                    <UserCheck size={20} />
                    복관 처리 (재원 상태로 변경)
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 ml-1 font-bold italic">
                {currentStatus === 'ACTIVE' 
                  ? "* 휴관/퇴관 처리 후 하단의 저장 버튼을 눌러야 반영됩니다." 
                  : "* 복관 처리 후 하단의 저장 버튼을 눌러야 반영됩니다."}
              </p>
            </div>
          </div>

          <button type="submit" className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4.5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2">
            <Save size={22} />
            {currentStatus === 'ACTIVE' && student.status !== 'ACTIVE' ? '복관 정보 저장하기' : '정보 수정 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}
