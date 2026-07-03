'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardEdit, Camera, Home } from 'lucide-react';
import { insertRows, queryTable, executeSQL } from '@root/egdesk-helpers';
interface CustomField {
  id: number;
  field_name: string;
  display_name: string;
}

export default function StudentRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<any>({
    name: '',
    parentName: '',
    parentPhone: '',
    birthDate: '',
    rank: '',
    memo: '',
    classId: '1',
    receiveSmsIn: true,
    receiveSmsOut: true,
  });
  const [classes, setClasses] = useState<{id: number, name: string}[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState('AI 모델 로딩 중...');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mounted, setMounted] = useState(false);
  const isPageMounted = useRef(true);
  const faceapiRef = useRef<any>(null);

  useEffect(() => {
    isPageMounted.current = true;
    setMounted(true);
    const loadModels = async () => {
      try {
        const faceapi = await import('@vladmandic/face-api');
        faceapiRef.current = faceapi;
        const MODEL_URL = '/models/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (isPageMounted.current) {
          setIsModelLoaded(true);
          setStatus('');
        }
      } catch (err) {
        console.error('모델 로드 실패:', err);
        if (isPageMounted.current) {
          setStatus('AI 모델 로드 실패. 서버 설정을 확인하세요.');
        }
      }
    };
    loadModels();
    fetchCustomFields();
    fetchClasses();

    return () => {
      isPageMounted.current = false;
      stopVideo();
    };
  }, []);



  const fetchClasses = async () => {
    try {
      const res = await queryTable('student_classes');
      if (res.rows && res.rows.length > 0) {
        setClasses(res.rows);
        setFormData(prev => ({ ...prev, classId: String(res.rows[0].id) }));
      }
    } catch (err) {
      console.error('반 로드 실패:', err);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const res = await queryTable('custom_fields');
      const fields = res.rows || [];
      setCustomFields(fields);
      
      const initialCustomData: any = {};
      fields.forEach((field: CustomField) => {
        initialCustomData[field.field_name] = '';
      });
      setFormData((prev: any) => ({ ...prev, ...initialCustomData }));
    } catch (err) {
      console.error('커스텀 필드 로드 실패:', err);
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log('Webcam stream stopped');
    }
  };

  const startVideo = async () => {
    if (!isPageMounted.current) return;
    if (videoRef.current?.srcObject) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      
      if (!isPageMounted.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('');
      }
    } catch (err) {
      console.error('Webcam access failed:', err);
      if (isPageMounted.current) {
        setStatus('웹캠을 찾을 수 없습니다.');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const toggleCamera = () => {
    if (!isCameraOn) {
      // 카메라 켜기 전 입력창(이름, 생일, 부모님 성함, 연락처, 급/단, 반) 작성 여부 검사
      if (!formData.name || !formData.birthDate || !formData.parentName || !formData.parentPhone || !formData.rank || !formData.classId) {
        alert('카메라를 켜기 전에 기본 정보(이름, 생년월일, 학부모 성함/연락처, 급/단, 반 선택)를 모두 입력해주세요.');
        return;
      }
      setIsCameraOn(true);
      setStatus('카메라 켜는 중...');
      startVideo();
    } else {
      stopVideo();
      setIsCameraOn(false);
      setStatus('');
      setIsFaceDetected(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }
  };

  // Face Tracking Loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    const trackFace = async () => {
      if (!isModelLoaded || !videoRef.current || !canvasRef.current || isCapturing) {
        if (isActive) timeoutId = setTimeout(trackFace, 30);
        return;
      }
      
      if (videoRef.current.readyState < 2) {
        if (isActive) timeoutId = setTimeout(trackFace, 30);
        return;
      }

      try {
        const faceapi = faceapiRef.current || await import('@vladmandic/face-api');
        // AI 인식 영역(해상도)을 약 30% 이상 키워(160 -> 224) 얼굴 전반을 상세하게 스캔
        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }));
        
        const canvas = canvasRef.current;
        if (canvas.width !== videoRef.current.videoWidth) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
        }
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (detection) {
            setIsFaceDetected(true);
            const { x, y, width, height } = detection.box;
            
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, 16);
            ctx.stroke();
            
            ctx.fillStyle = '#3B82F6';
            ctx.font = 'bold 24px sans-serif';
            ctx.save();
            // Flip text back because canvas is flipped horizontally
            ctx.translate(x + width / 2, y - 10);
            ctx.scale(-1, 1);
            ctx.textAlign = 'center';
            ctx.fillText('FACE DETECTED', 0, 0);
            ctx.restore();
          } else {
            setIsFaceDetected(false);
          }
        }
      } catch (err) {}

      if (isActive) {
        timeoutId = setTimeout(trackFace, 30);
      }
    };

    if (isModelLoaded) {
      trackFace();
    }

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [isModelLoaded, isCapturing]);

  const handleRegister = async () => {
    if (!formData.name) {
      alert('학생 이름을 입력해주세요.');
      return;
    }

    if (!videoRef.current) return;

    setIsCapturing(true);
    setStatus('얼굴 특징 분석 중...');

    try {
      const faceapi = faceapiRef.current || await import('@vladmandic/face-api');
      
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sw = canvas.width / zoom;
        const sh = canvas.height / zoom;
        const sx = (canvas.width - sw) / 2;
        const sy = (canvas.height - sh) / 2;
        ctx.drawImage(videoRef.current, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      }

      const allDetections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!allDetections || allDetections.length === 0) {
        setStatus('얼굴을 인식하지 못했습니다. 다시 시도해주세요.');
        setIsCapturing(false);
        return;
      }

      if (allDetections.length > 1) {
        setStatus('다중 얼굴 감지됨');
        alert('화면에 한 명의 얼굴만 위치하도록 카메라를 조정해주세요.');
        setIsCapturing(false);
        return;
      }

      const detections = allDetections[0];
      
      const faceWidthRatio = detections.detection.box.width / canvas.width;
      if (faceWidthRatio < 0.2) {
        setStatus('얼굴이 너무 멉니다');
        alert('인식률 향상을 위해 카메라에 조금 더 가까이 다가와 주세요.');
        setIsCapturing(false);
        return;
      }

      const faceVector = JSON.stringify(Array.from(detections.descriptor));
      
      // Capture snapshot for profile image
      let profileImage = null;
      if (ctx) {
        profileImage = canvas.toDataURL('image/jpeg', 0.7);
      }

      
      
      const insertData: any = {
        name: formData.name,
        parent_name: formData.parentName,
        parent_phone: formData.parentPhone,
        birth_date: formData.birthDate,
        rank: formData.rank,
        memo: formData.memo,
        face_vector: faceVector,
        profile_image: profileImage,
        class_id: parseInt(formData.classId),
        receive_sms_in: formData.receiveSmsIn ? 'true' : 'false',
        receive_sms_out: formData.receiveSmsOut ? 'true' : 'false'
      };

      customFields.forEach(field => {
        insertData[field.field_name] = formData[field.field_name] || '';
      });

      // 1. 이름+생년월일 중복 체크
      const existingRes = await queryTable('students', {
        filters: {
          name: formData.name,
          birth_date: formData.birthDate
        }
      });

      if (existingRes.rows && existingRes.rows.length > 0) {
        setStatus('이미 등록된 학생입니다.');
        alert(`이미 '${formData.name}'(생일: ${formData.birthDate}) 학생이 등록되어 있습니다. 중복 등록은 불가능합니다.`);
        setIsCapturing(false);
        router.back();
        return;
      }

      // 2. 얼굴(사진) 기반 중복 체크
      setStatus('얼굴 중복 여부 확인 중...');
      const allStudentsRes = await queryTable('students');
      if (allStudentsRes.rows) {
        for (const existingStudent of allStudentsRes.rows) {
          if (!existingStudent.face_vector) continue;
          try {
            const existingVector = new Float32Array(JSON.parse(existingStudent.face_vector));
            const distance = faceapi.euclideanDistance(detections.descriptor, existingVector);
            // 출결 시 인식되는 것과 동일한 사람인지 판별
            if (distance < 0.6) {
              setStatus('중복된 얼굴 인식됨');
              alert(`해당 얼굴은 이미 '${existingStudent.name}' 관원으로 등록되어 있습니다.\n동일한 얼굴(사진)을 중복해서 등록할 수 없습니다.`);
              setIsCapturing(false);
              router.back();
              return;
            }
          } catch (e) {}
        }
      }
      
      setStatus('데이터베이스 저장 중...');
      await insertRows('students', [insertData]);

      setStatus('등록 완료!');
      alert(`${formData.name} 학생이 성공적으로 등록되었습니다.`);
      
      // 이전 메뉴로 이동
      router.back();
      
      const resetData: any = {
        name: '',
        parentName: '',
        parentPhone: '',
        birthDate: '',
        rank: '',
        memo: '',
        classId: '1',
        receiveSmsIn: true,
        receiveSmsOut: true
      };
      customFields.forEach(field => {
        resetData[field.field_name] = '';
      });
      setFormData(resetData);
    } catch (err: any) {
      console.error('등록 실패:', err);
      setStatus(`등록 실패: ${err.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h2 style={{ fontSize: '40px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.05em', cursor: 'pointer' }}>신규 관원 등록</h2>
          </Link>
        </div>
        <div>
          <Link 
            href="/attendance" 
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-blue-600 transition-colors cursor-pointer no-underline"
          >
            <Home size={20} />
            <span>홈으로 가기</span>
          </Link>
        </div>
      </header>

      <main style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', justifyContent: 'center' }}>
        {/* Left: Form */}
        {!isCameraOn && (
          <div style={{ flex: 1 }} className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">학생 이름 *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">생년월일</label>
                <input
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                  placeholder="YYYY-MM-DD"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">학부모 성함</label>
                <input
                  name="parentName"
                  value={formData.parentName}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                  placeholder="학부모 성함을 입력하세요"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">학부모 연락처</label>
                <input
                  name="parentPhone"
                  value={formData.parentPhone}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                  placeholder="010-0000-0000"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">알림 문자 설정</label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 transition-all hover:bg-slate-100 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      name="receiveSmsIn"
                      checked={formData.receiveSmsIn}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, receiveSmsIn: e.target.checked }))}
                      className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700">등원 받기</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 transition-all hover:bg-slate-100 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      name="receiveSmsOut"
                      checked={formData.receiveSmsOut}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, receiveSmsOut: e.target.checked }))}
                      className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700">하원 받기</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">급/단</label>
                <input
                  name="rank"
                  value={formData.rank}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                  placeholder="예: 1급, 2단"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">반 선택</label>
                <select
                  name="classId"
                  value={formData.classId}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm appearance-none cursor-pointer"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              {customFields.map(field => (
                <div key={field.id} className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">{field.display_name}</label>
                  <input
                    name={field.field_name}
                    value={formData[field.field_name] || ''}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                    placeholder={`${field.display_name} 정보를 입력하세요`}
                  />
                </div>
              ))}

              <div className="flex flex-col gap-2 col-span-1 md:col-span-2 group">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-500">메모</label>
                <textarea
                  name="memo"
                  value={formData.memo}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 h-32 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none shadow-sm"
                  placeholder="기타 특이사항을 입력하세요"
                />
              </div>
            </div>
          </div>
        )}

        {/* Right: AI Registration */}
        <div style={{ 
          flex: isCameraOn ? '0 1 640px' : 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '32px',
          width: '100%',
          transition: 'all 0.5s ease-in-out'
        }}>
          <div style={{ backgroundColor: '#0F172A', width: '100%', borderRadius: '40px', padding: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            {/* Scanner Effect */}
            {isCameraOn && (
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,1)] animate-scan z-10"></div>
            )}
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white tracking-tight">AI 얼굴 벡터 분석기</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleCamera} 
                  className="bg-transparent border-none p-1 cursor-pointer transition-transform active:scale-90"
                  title="카메라 켜기/끄기"
                >
                  <Camera 
                    size={24} 
                    className={isCameraOn ? "text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"} 
                  />
                </button>
                <span style={{ 
                  fontSize: '10px', 
                  padding: '6px 12px', 
                  borderRadius: '9999px', 
                  fontWeight: 900, 
                  backgroundColor: !isCameraOn ? '#991B1B' : (isFaceDetected ? '#065F46' : '#1E293B'),
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {!isCameraOn ? '꺼짐' : (isFaceDetected ? '작동중' : '대기중')}
                </span>
              </div>
            </div>

            <div className="relative w-full aspect-video bg-black rounded-[32px] overflow-hidden border-2 border-slate-800 shadow-inner group mb-4">
              <video
                ref={videoRef}
                autoPlay
                muted
                style={{ transform: `scaleX(-1) scale(${zoom})`, transformOrigin: 'center' }}
                className="w-full h-full object-cover opacity-90 transition-transform duration-200"
              />
              <canvas 
                ref={canvasRef} 
                style={{ transform: `scaleX(-1) scale(${zoom})`, transformOrigin: 'center' }} 
                className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-200 pointer-events-none" 
              />

              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <span className="text-emerald-400 text-sm md:text-base font-black tracking-wide bg-slate-900/80 px-6 py-3 rounded-full border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] backdrop-blur-md">
                    먼저 신규관원 등록 후 카메라를 켜세요.
                  </span>
                </div>
              )}
              
              {isCapturing && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-slate-500/20 border-t-white rounded-full animate-spin"></div>
                    <span className="text-white text-xs font-black tracking-widest">EXTRACTING...</span>
                  </div>
                </div>
              )}
              
              {status && (
                <div className="absolute bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <p className={`text-[12px] font-bold text-center leading-relaxed ${status.includes('실패') ? 'text-red-400' : 'text-white'}`}>
                    {status}
                  </p>
                </div>
              )}
            </div>

            {/* Zoom Slider */}
            <div className="flex items-center gap-4 mb-6 bg-[#1E293B] p-4 rounded-2xl border border-white/5">
              <span className="text-xs font-black text-slate-400">줌</span>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500 cursor-pointer"
              />
              <span className="text-xs font-black text-blue-400 w-8 text-right">{zoom.toFixed(1)}x</span>
            </div>

            <button
              onClick={handleRegister}
              disabled={!isModelLoaded || isCapturing}
              style={{
                width: '100%',
                padding: '20px 0',
                borderRadius: '24px',
                fontWeight: 900,
                fontSize: '18px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: (!isModelLoaded || isCapturing) ? 'not-allowed' : 'pointer',
                backgroundColor: (isModelLoaded && !isCapturing) ? '#2563EB' : '#1E293B',
                color: (isModelLoaded && !isCapturing) ? '#FFFFFF' : '#64748B',
                border: 'none',
                boxShadow: (isModelLoaded && !isCapturing) ? '0 10px 15px -3px rgba(37, 99, 235, 0.3)' : 'none'
              }}
            >
              {!isCapturing && <Camera size={20} strokeWidth={2.5} />}
              {isCapturing ? '처리 중...' : '촬영 및 등록 완료'}
            </button>
          </div>
          
          <div className="bg-white/50 border border-slate-200 p-6 rounded-[32px] w-full">
            <h4 className="font-black text-slate-900 mb-4">등록 시 주의사항</h4>
            <ul className="space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
              <li className="flex gap-3"><span className="text-slate-900 font-black">1.</span> 조명이 밝은 곳에서 정면을 응시해 주세요.</li>
              <li className="flex gap-3"><span className="text-slate-900 font-black">2.</span> 안경이나 마스크는 인식을 방해할 수 있습니다.</li>
              <li className="flex gap-3"><span className="text-slate-900 font-black">3.</span> 이름과 생년월일이 같은 관원은 중복 등록되지 않습니다.</li>
            </ul>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
