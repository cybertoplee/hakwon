'use client';
// Updated: 2026-05-14 16:54:00

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, TriangleAlert, CheckCircle, Loader2, MonitorPlay, UserPlus, Home, Camera } from 'lucide-react';
// import * as faceapi from '@vladmandic/face-api'; // 제거 후 useEffect 내 동적 임포트 사용
import { queryTable, insertRows, aggregateTable, executeSQL } from '@root/egdesk-helpers';
import { sendAttendanceSMSAction } from '../actions/sms';

interface Student {
  id: number;
  name: string;
  face_vector: string;
}

interface AttendanceLog {
  name: string;
  time: string;
  type: 'IN' | 'OUT';
}

export default function AttendanceMonitorPage() {
  const [mounted, setMounted] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [matchedStudents, setMatchedStudents] = useState<Array<{ 
    student: Student; 
    type: string; 
    smsStatus?: 'SENDING' | 'SUCCESS' | 'FAILED' 
  }>>([]);
  const [autoCheckoutMinutes, setAutoCheckoutMinutes] = useState(10);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const autoCheckoutMinutesRef = useRef(10);
  const smsEnabledRef = useRef(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  useEffect(() => {
    autoCheckoutMinutesRef.current = autoCheckoutMinutes;
  }, [autoCheckoutMinutes]);

  useEffect(() => {
    smsEnabledRef.current = smsEnabled;
  }, [smsEnabled]);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionCooldowns = useRef<Map<number, number>>(new Map());
  const lastDateRef = useRef<string>(new Date().toLocaleDateString('en-CA'));
  const isPageMounted = useRef(true);

  useEffect(() => {
    isPageMounted.current = true;
    setMounted(true);

    // 1. Load AI Models
    const loadModels = async () => {
      try {
        const faceapi = await import('@vladmandic/face-api');
        const MODEL_URL = '/models/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (isPageMounted.current) {
          setIsModelLoaded(true);
        }
      } catch (err) {
        console.error('모델 로드 실패:', err);
      }
    };

    // 2. Fetch Data from DB
    const fetchData = async () => {
      try {
        const res = await fetch('/api/attendance_init', { cache: 'no-store' });
        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();
        
        if (!isPageMounted.current) return;
        
        if (data.students) setStudents(data.students);
        setTodayCount(data.count || 0);

        if (data.logs && data.students) {
          const studentMap = new Map(data.students.map((s: any) => [s.id, s.name]));
          const formattedLogs = data.logs.map((l: any) => ({
            name: studentMap.get(l.student_id) || `ID: ${l.student_id}`,
            time: new Date(l.timestamp).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: l.type as 'IN' | 'OUT'
          }));
          setRecentLogs(formattedLogs);
        }

        if (data.settings && data.settings.length > 0) {
          const checkout = data.settings.find((s: any) => s.key === 'attendance_auto_checkout_minutes');
          const smsOn = data.settings.find((s: any) => s.key === 'sms_enabled');
          if (checkout) setAutoCheckoutMinutes(Number(checkout.value));
          if (smsOn) setSmsEnabled(smsOn.value === 'true' || smsOn.value === 'ON');
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      }
    };

    loadModels();
    fetchData();

    // 3. Update Clock
    const updateClock = () => {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      
      if (!isPageMounted.current) return;

      // 날짜가 바뀌었을 경우 리셋
      if (todayStr !== lastDateRef.current) {
        setTodayCount(0);
        setRecentLogs([]);
        lastDateRef.current = todayStr;
      }

      setCurrentDate(now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }));
      setCurrentTime(now.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);

    return () => {
      isPageMounted.current = false;
      clearInterval(timer);
      stopVideo();
    };
  }, []);

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log('Webcam stream stopped');
    }
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopVideo();
      setIsCameraOn(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      setIsCameraOn(true);
      startVideo();
    }
  };

  const [cameraError, setCameraError] = useState('');

  const startVideo = async () => {
    if (!isPageMounted.current) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setCameraError('이 브라우저에서는 카메라를 사용할 수 없습니다. (HTTPS 환경 또는 PC 필요)');
      return;
    }
    if (videoRef.current?.srcObject) return; // Already active

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
        console.log('Webcam stream started');
        setCameraError('');
      }
    } catch (err: any) {
      console.error('Webcam access error:', err);
      if (isPageMounted.current) {
        let errMsg = '카메라 접근 권한이 없거나 카메라를 찾을 수 없습니다.';
        if (err.name === 'NotAllowedError') {
          errMsg = '카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
        } else if (err.name === 'NotFoundError') {
          errMsg = 'PC에 연결된 카메라 장치를 찾을 수 없습니다. 웹캠이 제대로 연결되어 있는지 확인해주세요.';
        } else if (err.name === 'NotReadableError') {
          errMsg = '카메라가 이미 다른 프로그램(예: 줌, 카카오톡, 다른 브라우저 탭)에서 사용 중입니다.';
        } else if (err.name === 'AbortError') {
          errMsg = '카메라를 시작하는 중 시간이 초과되었습니다. 카메라가 멈췄거나, 백신 프로그램 및 하드웨어 설정(프라이버시 셔터)에 의해 차단되었을 수 있습니다.';
        } else {
          errMsg = `카메라 에러: ${err.name} - ${err.message}`;
        }
        setCameraError(errMsg);
      }
    }
  };

  useEffect(() => {
    // 자동 실행 해제: 사용자가 직접 ON 버튼을 눌러야 실행됨
  }, [isModelLoaded]);

  // 실시간 얼굴 인식 루프
  useEffect(() => {
    if (!isModelLoaded) return;
    
    let isRunning = true;
    console.log('얼굴 인식 루프 준비 완료');

    const recognitionLoop = async () => {
      if (!isRunning) return;
      
      // Stricter check: video must be ready AND have positive dimensions AND be playing
      const video = videoRef.current;
      if (!video || video.readyState < 3 || video.videoWidth === 0 || video.paused) {
        requestAnimationFrame(recognitionLoop);
        return;
      }

      try {
        const faceapi = await import('@vladmandic/face-api');
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // 캔버스 크기 조정
        const displayWidth = video.offsetWidth || video.videoWidth;
        const displayHeight = video.offsetHeight || video.videoHeight;
        
        if (displayWidth <= 0 || displayHeight <= 0) {
          if (isRunning) requestAnimationFrame(recognitionLoop);
          return;
        }
        
        const displaySize = { width: displayWidth, height: displayHeight };
        if (canvas.width !== displaySize.width) {
          faceapi.matchDimensions(canvas, displaySize);
        }

        // 탐지 시작 (다중 얼굴 인식으로 변경, 임계값 상향 조정하여 오인식 방지)
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections && detections.length > 0) {
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          
          for (const detection of resizedDetections) {
            const descriptor = detection.descriptor;
            let bestMatch = { student: null as Student | null, distance: 1.0 };

            for (const student of students) {
              if (!student.face_vector) continue;
              try {
                const studentVector = new Float32Array(JSON.parse(student.face_vector));
                const distance = faceapi.euclideanDistance(descriptor, studentVector);
                if (distance < bestMatch.distance) {
                  bestMatch = { student, distance };
                }
              } catch (e) {}
            }

            const isMatch = bestMatch.student && bestMatch.distance < 0.7; // 임계값을 0.7로 대폭 상향하여 무조건 인식되도록 완화
            
            // 사이버틱 스캔 타겟팅 박스 직접 그리기
            if (ctx) {
              const { x, y, width, height } = detection.detection.box;
              const color = isMatch ? '#10B981' : '#3B82F6'; // 매칭 시 초록색, 평소 파란색
              const length = 25; // 꺾임 선 길이
              
              ctx.strokeStyle = color;
              ctx.lineWidth = 4;
              ctx.beginPath();
              
              // 좌상단
              ctx.moveTo(x, y + length);
              ctx.lineTo(x, y);
              ctx.lineTo(x + length, y);
              // 우상단
              ctx.moveTo(x + width - length, y);
              ctx.lineTo(x + width, y);
              ctx.lineTo(x + width, y + length);
              // 우하단
              ctx.moveTo(x + width, y + height - length);
              ctx.lineTo(x + width, y + height);
              ctx.lineTo(x + width - length, y + height);
              // 좌하단
              ctx.moveTo(x + length, y + height);
              ctx.lineTo(x, y + height);
              ctx.lineTo(x, y + height - length);
              
              ctx.stroke();

              if (isMatch && bestMatch.student) {
                // 매칭 정확도(Confidence Score) 
                const confidence = Math.max(0, Math.min(99, Math.round((0.75 - bestMatch.distance) * 200)));
                const labelText = `${bestMatch.student.name} (일치율 ${confidence}%)`;
                
                ctx.save();
                // 텍스트가 거울 모드에서 좌우 반전되지 않도록 스케일 반전
                ctx.translate(x + width / 2, y - 10);
                ctx.scale(-1, 1);
                ctx.textAlign = 'center';
                
                const textWidth = ctx.measureText(labelText).width;
                ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
                ctx.fillRect(-textWidth/2 - 10, -22, textWidth + 20, 28);
                
                ctx.fillStyle = '#10B981';
                ctx.font = '900 18px sans-serif';
                ctx.fillText(labelText, 0, 0);
                ctx.restore();
              }
            }

            if (isMatch && bestMatch.student) {
              handleRecognitionSuccess(bestMatch.student);
            }
          }
        }
      } catch (err) {
        console.error('Recognition error:', err);
      }

      if (isRunning) requestAnimationFrame(recognitionLoop);
    };

    recognitionLoop();
    return () => { isRunning = false; };
  }, [isModelLoaded, students]);

  const handleRecognitionSuccess = async (student: Student) => {
    const now = Date.now();
    const todayStr = new Date().toLocaleDateString('en-CA');
    const lastRecognized = recognitionCooldowns.current.get(student.id) || 0;
    
    // 1. 아주 짧은 간격(5초) 연속 인식은 완전히 무시
    if (now - lastRecognized < 5000) {
      return;
    }
    recognitionCooldowns.current.set(student.id, now);

    let determinedType: 'IN' | 'OUT' | 'DUPLICATE' = 'IN';

    // 2. DB 기반 상태 확인 및 처리 (당일 마지막 기록 확인)
    try {
      const lastLog = await executeSQL(`
        SELECT type, timestamp 
        FROM attendance_logs 
        WHERE student_id = ${student.id} 
        AND timestamp LIKE '${todayStr}%'
        ORDER BY id DESC
        LIMIT 1
      `);
      
      const lastEntry = lastLog.rows?.[0];
      
      if (lastEntry) {
        const lastTime = new Date(lastEntry.timestamp).getTime();
        const diffMinutes = (now - lastTime) / (1000 * 60);

        if (lastEntry.type === 'IN') {
          if (diffMinutes < autoCheckoutMinutesRef.current) {
            determinedType = 'DUPLICATE';
          } else {
            determinedType = 'OUT';
            const localISO = new Date(now - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19);
            await insertRows('attendance_logs', [{
              student_id: student.id,
              timestamp: localISO,
              type: 'OUT',
              status: 'NORMAL',
              sms_status: (smsEnabledRef.current && student.receive_sms_out !== 'false') ? 'SENDING' : 'NONE'
            }]);
            
            // 과금용 사용량 통계 로깅 (얼굴 인식 건수 증가)
            await insertRows('tkd_usage_logs', [{
              type: 'FACE',
              timestamp: localISO,
              student_id: student.id
            }]).catch(e => console.warn('사용량 로깅 실패:', e));
          }
        } else if (lastEntry.type === 'OUT') {
          determinedType = 'DUPLICATE';
        }
      } else {
        // 신규 등원 처리
        determinedType = 'IN';
        const localISO = new Date(now - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19);
        await insertRows('attendance_logs', [{
          student_id: student.id,
          timestamp: localISO,
          type: 'IN',
          status: 'NORMAL',
          sms_status: (smsEnabledRef.current && student.receive_sms_in !== 'false') ? 'SENDING' : 'NONE'
        }]);

        // 과금용 사용량 통계 로깅 (얼굴 인식 건수 증가)
        await insertRows('tkd_usage_logs', [{
          type: 'FACE',
          timestamp: localISO,
          student_id: student.id
        }]).catch(e => console.warn('사용량 로깅 실패:', e));
      }
    } catch (err) {
      console.error('출결 상태 확인 실패:', err);
      return;
    }

    // UI 업데이트: 다중 팝업 지원 (팝업은 중복인 경우에도 알림을 위해 표시)
    setMatchedStudents((prev) => [...prev, { student, type: determinedType }]);
    
    // 최근 기록 업데이트 (실제 등원/하원인 경우에만 추가)
    if (determinedType !== 'DUPLICATE') {
      setRecentLogs((prev) => [
        { 
          name: student.name, 
          time: new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: determinedType
        },
        ...prev.slice(0, 4)
      ]);

      // 오늘 등원 수 증가 (신규 등원인 경우에만)
      if (determinedType === 'IN') {
        setTodayCount((prev) => prev + 1);
      }

      // 학부모 알림 문자 발송 (설정된 경우 & 관원이 해당 타입 수신 동의한 경우)
      if (smsEnabledRef.current && ((determinedType === 'IN' && student.receive_sms_in !== 'false') || (determinedType === 'OUT' && student.receive_sms_out !== 'false'))) {
        // 발송 중 상태 표시
        setMatchedStudents(prev => prev.map(item => 
          item.student.id === student.id ? { ...item, smsStatus: 'SENDING' } : item
        ));

        // 비동기 발송 및 결과 반영 (디버그 로그 추가)
        console.log('[SMS] Calling server action for student:', student.id);
        sendAttendanceSMSAction(student.id, determinedType).then(res => {
          console.log('[SMS] Server action response:', res);
          setMatchedStudents(prev => prev.map(item => 
            item.student.id === student.id 
              ? { ...item, smsStatus: res?.success ? 'SUCCESS' : 'FAILED' } 
              : item
          ));
        }).catch(() => {
          setMatchedStudents(prev => prev.map(item => 
            item.student.id === student.id ? { ...item, smsStatus: 'FAILED' } : item
          ));
        });
      }
    }

    // 3초 후 해당 학생 팝업 제거
    setTimeout(() => {
      setMatchedStudents((prev) => prev.filter(s => s.student.id !== student.id));
    }, 3000);
  };

  if (!mounted) return null;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">
      {/* Background Video */}
      <div className="absolute inset-0 bg-slate-950">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover filter contrast-105 brightness-110 transition-opacity duration-500 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* HUD Scanner Effect overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        {isCameraOn && <div className="absolute top-0 left-0 w-full h-2 bg-blue-500/30 blur-md animate-scan z-0"></div>}
      </div>
      
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none z-10" 
        style={{ transform: 'scaleX(-1)' }}
      />

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
          <div className="flex flex-col items-center gap-4 text-center">
            <TriangleAlert size={64} className="text-red-500" />
            <h2 className="text-2xl font-bold text-white">카메라 에러</h2>
            <p className="text-slate-300 max-w-md">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Central Camera Toggle Button */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
        <button 
          onClick={toggleCamera}
          className={`pointer-events-auto flex flex-col items-center justify-center gap-2 rounded-[32px] backdrop-blur-md transition-all duration-500 active:scale-95 border shadow-2xl ${
            isCameraOn 
              ? "w-32 h-20 bg-red-500/10 border-red-500/30 hover:bg-red-500/30 text-red-100 opacity-20 hover:opacity-100 translate-y-80" 
              : "w-64 h-64 bg-emerald-500/90 border-emerald-400 hover:bg-emerald-400 text-white shadow-[0_0_50px_rgba(16,185,129,0.5)]"
          }`}
        >
          <Camera size={isCameraOn ? 24 : 80} className={isCameraOn ? "text-red-400" : "text-white"} />
          <span className={`font-black tracking-widest ${isCameraOn ? "text-[10px]" : "text-2xl mt-4"}`}>
            {isCameraOn ? "카메라 끄기" : "출석 시작 (ON)"}
          </span>
        </button>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-16 pointer-events-none z-20">
        {/* Top Bar - Glassmorphism */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <Link href="/" className="flex flex-col items-start gap-0.5 cursor-pointer no-underline hover:opacity-80 transition-opacity">
            <div className="text-lg md:text-2xl font-bold text-white tracking-tight opacity-80">
              {currentDate}
            </div>
            <div className="text-6xl md:text-9xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] tracking-tighter tabular-nums leading-none">
              {currentTime}
            </div>
          </Link>
          
          <div className="flex flex-col items-end gap-2 md:gap-4 w-full md:w-auto">
            <div className="hidden md:flex items-center gap-2 md:gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
              <Link
                href="/admin/students/register"
                className="pointer-events-auto bg-slate-900/80 hover:bg-slate-900 text-white px-5 py-3 md:px-8 md:py-4 rounded-full border border-white/20 backdrop-blur-md transition-all text-xs md:text-base font-bold shadow-2xl active:scale-95 flex items-center gap-2 no-underline whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} /> <span>신규 등록</span>
              </Link>

              <button 
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                  } else {
                    document.exitFullscreen();
                  }
                }}
                className="pointer-events-auto bg-white/10 hover:bg-white/20 text-white px-5 py-3 md:px-8 md:py-4 rounded-full border border-white/20 backdrop-blur-md transition-all text-xs md:text-base font-bold shadow-lg active:scale-95 flex items-center gap-2 whitespace-nowrap"
              >
                <MonitorPlay className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} /> <span>전체 화면</span>
              </button>

              <Link
                href="/"
                className="pointer-events-auto bg-slate-900/80 hover:bg-slate-900 text-white px-5 py-3 md:px-8 md:py-4 rounded-full border border-white/20 backdrop-blur-md transition-all text-xs md:text-base font-bold shadow-2xl active:scale-95 flex items-center gap-2 no-underline whitespace-nowrap"
              >
                <Home className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
              </Link>
            </div>
            
            {!isModelLoaded && (
              <div className="flex items-center gap-3 md:gap-4 bg-blue-500/20 backdrop-blur-md px-5 py-3 md:px-8 md:py-4 rounded-full border border-blue-500/30 w-full md:w-auto">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-400 rounded-full animate-ping" />
                <span className="text-sm md:text-xl font-black text-blue-50 tracking-wide">AI 시스템 초기화 중...</span>
              </div>
            )}
          </div>
        </div>

        {/* Center Target Guide - Futuristic Responsive */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[350px] md:w-[400px] md:h-[500px] pointer-events-none">
          {/* Corner Brackets */}
          <div className="absolute top-0 left-0 w-12 h-12 md:w-16 md:h-16 border-t-4 border-l-4 border-blue-500/50 rounded-tl-3xl"></div>
          <div className="absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 border-t-4 border-r-4 border-blue-500/50 rounded-tr-3xl"></div>
          <div className="absolute bottom-0 left-0 w-12 h-12 md:w-16 md:h-16 border-b-4 border-l-4 border-blue-500/50 rounded-bl-3xl"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 md:w-16 md:h-16 border-b-4 border-r-4 border-blue-500/50 rounded-br-3xl"></div>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 md:w-8 md:h-8 opacity-30">
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-blue-500 -translate-y-1/2"></div>
            <div className="absolute top-0 left-1/2 w-[2px] h-full bg-blue-500 -translate-x-1/2"></div>
          </div>
        </div>

        {/* Bottom Logs - Glassmorphism Cards */}
        <div className="flex flex-col gap-4 md:gap-6 max-w-full overflow-hidden">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
              <span className="w-2 h-2 md:w-2.5 md:h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            </div>
            <div className="flex items-baseline gap-3 md:gap-5 mb-[-2px] md:mb-[-5px]">
              <h2 className="text-sm md:text-xl font-black text-white uppercase tracking-[0.2em] leading-none pb-2 md:pb-3 m-0">오늘 등원</h2>
              <span className="text-5xl md:text-8xl font-black text-white leading-none tracking-tighter">{todayCount}</span>
            </div>
          </div>
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 no-scrollbar mask-fade-right">
            {recentLogs.map((log, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-white/5 backdrop-blur-xl px-4 md:pr-6 py-3 md:py-4 rounded-[20px] md:rounded-[28px] border-none shadow-none animate-in slide-in-from-left-8 duration-500">
                <div className={`w-8 h-8 md:w-10 md:h-10 ${log.type === 'OUT' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white'} rounded-lg md:rounded-xl flex items-center justify-center relative shrink-0`}>
                  <User className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
                  <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${log.type === 'OUT' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                </div>
                <div className="flex items-baseline gap-2 md:gap-3">
                  <span className="text-lg md:text-2xl font-black text-white tracking-tight leading-none whitespace-nowrap">{log.name}</span>
                  <span className="text-[10px] md:text-14 font-bold text-white/60 tracking-wider leading-none">{log.time}</span>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 px-5 py-3 md:p-6 rounded-[20px] md:rounded-[24px] text-white/50 text-[10px] md:text-sm font-bold tracking-widest flex items-center gap-2 md:gap-3">
                <Loader2 className="animate-spin text-white/50 w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={3} />
                AWAITING FIRST STUDENT...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Premium Success/Duplicate Popup - Responsive */}
      {matchedStudents.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none p-4 md:p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl animate-in fade-in duration-500"></div>
          
          <div className="relative w-full max-w-lg md:max-w-5xl flex flex-col gap-4 md:gap-6 items-center justify-center animate-in zoom-in-95 slide-in-from-bottom-20 duration-700">
            {matchedStudents.map(({ student, type, smsStatus }, index) => (
              <div 
                key={`${student.id}-${index}`}
                className="relative w-full bg-white/10 backdrop-blur-3xl rounded-[30px] md:rounded-[40px] overflow-hidden animate-in slide-in-from-bottom-10 duration-500 shadow-none border-none"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent"></div>

                <div className="relative z-10 flex flex-col items-center py-12 md:py-20 px-6 md:px-12 gap-6 md:gap-10 text-center">
                  <div className="flex-shrink-0 flex items-center justify-center text-white animate-pulse">
                    {type === 'DUPLICATE' ? (
                      <TriangleAlert className="w-[60px] h-[60px] md:w-[100px] md:h-[100px] text-amber-500" strokeWidth={1.5} />
                    ) : type === 'OUT' ? (
                      <CheckCircle className="w-[60px] h-[60px] md:w-[100px] md:h-[100px] text-blue-500" strokeWidth={1.5} />
                    ) : (
                      <CheckCircle className="w-[60px] h-[60px] md:w-[100px] md:h-[100px] text-emerald-500" strokeWidth={1.5} />
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-4 md:gap-6">
                    <div className="text-6xl md:text-9xl font-black text-white tracking-tighter leading-none">
                      {student.name}
                    </div>
                    <div 
                      className="text-xl md:text-4xl font-bold px-4"
                      style={{ 
                        color: type === 'DUPLICATE' ? '#f59e0b' : '#ffffff',
                      }}
                    >
                      {type === 'DUPLICATE' 
                        ? '이미 오늘 출결 처리가 완료되었습니다.' 
                        : type === 'OUT' 
                          ? '정상적으로 하원 처리되었습니다!' 
                          : '정상적으로 등원 처리되었습니다!'}
                    </div>

                    {(type === 'IN' || type === 'OUT') && (
                      <div className="mt-4 md:mt-8 flex items-center gap-3 md:gap-4 px-5 py-3 md:px-8 md:py-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        {(!smsStatus || smsStatus === 'SENDING') && (
                          <>
                            <Loader2 className="animate-spin text-blue-400 w-[18px] h-[18px] md:w-6 md:h-6" />
                            <span className="text-sm md:text-2xl font-black text-blue-100">알림 문자 발송 중...</span>
                          </>
                        )}
                        {smsStatus === 'SUCCESS' && (
                          <>
                            <CheckCircle className="text-emerald-500 w-[18px] h-[18px] md:w-6 md:h-6" />
                            <span className="text-sm md:text-2xl font-black text-emerald-100">알림 문자 발송 완료 ✅</span>
                          </>
                        )}
                        {smsStatus === 'FAILED' && (
                          <>
                            <TriangleAlert className="text-red-500 w-[18px] h-[18px] md:w-6 md:h-6" />
                            <span className="text-sm md:text-2xl font-black text-red-100">발송 실패 (연결 확인 필요) ❌</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-24 md:w-40 h-1 md:h-1.5 rounded-t-full ${
                    type === 'DUPLICATE' ? 'bg-amber-500' : type === 'OUT' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
        .mask-fade-right {
          mask-image: linear-gradient(to right, black 80%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
