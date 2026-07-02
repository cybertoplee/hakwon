'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, UserPlus, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ClientRegisterForm({ classes, customFields, error }: { classes: any[], customFields: any[], error?: string | null }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceVector, setFaceVector] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [processStatus, setProcessStatus] = useState<string>('AI 엔진 대기중...');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelError, setModelError] = useState<string>('');

  // Form states for local control of checkboxes
  const [smsIn, setSmsIn] = useState(true);
  const [smsOut, setSmsOut] = useState(true);

  useEffect(() => {
    // Load face-api script asynchronously without blocking UI
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
        setModelError('AI 엔진을 불러올 수 없습니다. 수동 등록만 가능합니다.');
      }
    };

    loadFaceApi();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif') {
      alert('스마트폰의 고화질 압축 포맷(HEIC)은 지원하지 않습니다. 일반 사진(JPG/PNG)을 선택하거나 직접 카메라로 촬영해주세요.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!isModelLoaded) {
      alert('AI 모델이 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setProcessStatus('사진 분석 중...');
    setFaceVector('');
    setProfileImage('');

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
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
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
        alert('얼굴을 인식하지 못했습니다. 정면 얼굴 사진을 올려주세요.');
        setIsProcessing(false);
        setProcessStatus('얼굴 인식 실패');
        return;
      }

      setFaceVector(JSON.stringify(Array.from(detections.descriptor)));

      const canvas = document.createElement('canvas');
      const box = detections.detection.box;
      const padding = box.width * 0.3;
      let sx = Math.max(0, box.x - padding);
      let sy = Math.max(0, box.y - padding);
      let sWidth = Math.min(tempCanvas.width - sx, box.width + padding * 2);
      let sHeight = Math.min(tempCanvas.height - sy, box.height + padding * 2);
      const size = Math.min(sWidth, sHeight);
      sx += (sWidth - size) / 2;
      sy += (sHeight - size) / 2;

      canvas.width = 150;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(tempCanvas, sx, sy, size, size, 0, 0, 150, 150);
        setProfileImage(canvas.toDataURL('image/jpeg', 0.8));
      }
      setProcessStatus('얼굴 분석 완료!');
    } catch (err) {
      console.error(err);
      alert('얼굴 분석 중 오류가 발생했습니다.');
      setProcessStatus('분석 오류');
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
        <h1 className="text-xl font-black text-slate-900 tracking-tight">신규 관원 등록</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {error && (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-2xl flex items-start gap-3 border border-amber-100">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center gap-4">
          <h2 className="text-sm font-bold text-slate-500 self-start">AI 얼굴 인식 프로필</h2>
          
          <div className="relative w-32 h-32 mt-2 cursor-pointer" onClick={() => !isProcessing && isModelLoaded && fileInputRef.current?.click()}>
            <div className={`w-full h-full rounded-full flex flex-col items-center justify-center border-4 overflow-hidden transition-all duration-300 ${profileImage ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-slate-100 bg-slate-50 border-dashed hover:bg-slate-100 hover:border-slate-300'}`}>
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : isProcessing ? (
                <Loader2 size={32} className="text-blue-500 animate-spin" />
              ) : (
                <>
                  <Camera size={32} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-400">사진 등록</span>
                </>
              )}
            </div>
            {profileImage && (
              <div className="absolute bottom-0 right-0 bg-green-500 text-white rounded-full p-1.5 border-4 border-white pointer-events-none z-10 shadow-sm">
                <CheckCircle2 size={16} strokeWidth={3} />
              </div>
            )}
          </div>
          
          <div className="w-full flex flex-col items-center mt-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              capture="user"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-5 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer transition-colors" 
              onChange={handleFileChange}
              disabled={!isModelLoaded || isProcessing}
            />
            <div className="mt-4 text-xs font-semibold flex flex-col items-center gap-2">
              {modelError ? (
                <span className="text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full"><AlertCircle size={14}/> {modelError}</span>
              ) : isModelLoaded ? (
                <span className="text-green-600 flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full"><CheckCircle2 size={14}/> AI 인식 엔진 준비 완료</span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full"><Loader2 size={14} className="animate-spin"/> {processStatus}</span>
              )}
            </div>
          </div>
        </div>

        <form action="/api/mobile_register_post" method="POST" className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
          <input type="hidden" name="face_vector" value={faceVector} />
          <input type="hidden" name="profile_image" value={profileImage} />

          <div className="grid grid-cols-1 gap-5">
            {/* 기본 정보 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">관원 이름 <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                name="name" 
                required
                placeholder="이름을 입력하세요"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">생년월일</label>
              <input 
                type="text" 
                name="birth_date" 
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">학부모 성함</label>
              <input 
                type="text" 
                name="parent_name" 
                placeholder="학부모 성함을 입력하세요"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">학부모 연락처</label>
              <input 
                type="tel" 
                name="parent_phone" 
                placeholder="010-0000-0000"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* 수련 및 알림 설정 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">수련반 선택</label>
              <select 
                name="class_id"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none"
              >
                {classes.length === 0 ? <option value="">반 정보 없음</option> : null}
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">급/단</label>
              <input 
                type="text" 
                name="rank" 
                placeholder="예: 1급, 2단"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
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

            {/* 커스텀 필드 */}
            {customFields.map(field => (
              <div key={field.id} className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-800 ml-1">{field.display_name}</label>
                <input 
                  type="text" 
                  name={field.field_name} 
                  placeholder={`${field.display_name} 입력`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 ml-1">메모</label>
              <textarea 
                name="memo" 
                rows={3}
                placeholder="특이사항을 입력하세요"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4.5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            <UserPlus size={22} />
            신규 관원 등록하기
          </button>
        </form>
      </div>
    </div>
  );
}
