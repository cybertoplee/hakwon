'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutGrid, Table, Download, FileSpreadsheet, UploadCloud, Settings, RefreshCw, Inbox, User, ClipboardEdit, Lightbulb, Camera, Search, CheckCircle2 } from 'lucide-react';
import { queryTable, deleteRows, updateRows, insertRows, executeSQL } from '@root/egdesk-helpers';
import { matchChosung } from '@/utils/koreanUtils';

interface Student {
  id: number;
  name: string;
  parent_name?: string;
  parent_phone?: string;
  birth_date?: string;
  rank?: string;
  memo?: string;
  profile_image?: string;
  face_vector?: string;
  [key: string]: any; 
}

interface CustomField {
  id: number;
  field_name: string;
  display_name: string;
}

export default function StudentManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [classMap, setClassMap] = useState<Record<number, string>>({});
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [importData, setImportData] = useState<any[]>([]);
  const [editFormData, setEditFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ON_HOLD' | 'DISCHARGED'>('ACTIVE');

  // Face Registration State
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceStatus, setFaceStatus] = useState('');
  const [newFaceVector, setNewFaceVector] = useState<string | null>(null);
  const [newProfileImage, setNewProfileImage] = useState<string | null>(null);
  const [pendingCapture, setPendingCapture] = useState<{vector: string, image: string} | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isPageMounted = useRef(true);

  useEffect(() => {
    isPageMounted.current = true;
    setMounted(true);
    fetchData();
    loadFaceModels();

    return () => {
      isPageMounted.current = false;
      stopVideo();
    };
  }, []);

  const loadFaceModels = async () => {
    try {
      const faceapi = await import('@vladmandic/face-api');
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      if (isPageMounted.current) {
        setIsModelLoaded(true);
      }
    } catch (err) {
      console.error('Face models load failed:', err);
    }
  };

  const startVideo = async (retryCount = 0) => {
    if (!isPageMounted.current) return;

    // If modal is not open yet, wait and retry
    if (!videoRef.current) {
      if (retryCount < 10) {
        setTimeout(() => startVideo(retryCount + 1), 100);
      }
      return;
    }

    // Already running?
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
        setFaceStatus('웹캠이 연결되었습니다.');
      }
    } catch (err) {
      console.error('Webcam access failed:', err);
      if (isPageMounted.current) {
        setFaceStatus('카메라 연결에 실패했습니다. 권한을 확인해주세요.');
      }
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Face Tracking Loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    const trackFace = async () => {
      // Run tracker only if editing, model is loaded, not capturing, and no pending capture
      if (!editingStudent || !isModelLoaded || !videoRef.current || !canvasRef.current || isCapturing || pendingCapture || newProfileImage) {
        if (isActive) timeoutId = setTimeout(trackFace, 150);
        return;
      }
      
      if (videoRef.current.readyState < 2) {
        if (isActive) timeoutId = setTimeout(trackFace, 150);
        return;
      }

      try {
        const faceapi = await import('@vladmandic/face-api');
        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }));
        
        const canvas = canvasRef.current;
        if (canvas.width !== videoRef.current.videoWidth) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
        }
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (detection) {
            const { x, y, width, height } = detection.box;
            
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, 16);
            ctx.stroke();
            
            ctx.fillStyle = '#3B82F6';
            ctx.font = 'bold 24px sans-serif';
            ctx.save();
            ctx.translate(x + width / 2, y - 10);
            ctx.scale(-1, 1);
            ctx.textAlign = 'center';
            ctx.fillText('FACE DETECTED', 0, 0);
            ctx.restore();
          }
        }
      } catch (err) {}

      if (isActive) {
        timeoutId = setTimeout(trackFace, 150);
      }
    };

    if (isModelLoaded && editingStudent) {
      trackFace();
    }

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [isModelLoaded, isCapturing, editingStudent, pendingCapture, newProfileImage]);

  const handleCaptureFace = async () => {
    if (!videoRef.current || !isModelLoaded) return;
    
    // 비디오가 실제로 재생 중인지 확인
    if (videoRef.current.readyState < 2) {
      setFaceStatus('카메라가 준비될 때까지 잠시만 기다려 주세요.');
      return;
    }

    setIsCapturing(true);
    setFaceStatus('얼굴 분석 중...');

    try {
      const faceapi = await import('@vladmandic/face-api');
      
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

      const detections = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        setFaceStatus('얼굴을 인식하지 못했습니다. 다시 시도해주세요.');
        return;
      }

      const vector = JSON.stringify(Array.from(detections.descriptor));
      
      // Capture snapshot for profile image
      if (ctx) {
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        setPendingCapture({ vector, image: base64Image });
        setFaceStatus('얼굴을 성공적으로 인식했습니다. 사진을 확인해 주세요.');
      }
    } catch (err) {
      console.error('Capture failed:', err);
      setFaceStatus('인식 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  const confirmCapture = () => {
    if (pendingCapture) {
      setNewFaceVector(pendingCapture.vector);
      setNewProfileImage(pendingCapture.image);
      setPendingCapture(null);
      setFaceStatus('얼굴 인식 성공! 저장 버튼을 눌러 완료하세요.');
    }
  };

  const rejectCapture = () => {
    setPendingCapture(null);
    setFaceStatus('다시 촬영해 주세요.');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const fieldsRes = await queryTable('custom_fields');
      setCustomFields(fieldsRes.rows || []);

      const classesRes = await queryTable('student_classes');
      const cmap: Record<number, string> = {};
      classesRes.rows?.forEach((cls: any) => {
        cmap[cls.id] = cls.name;
      });
      setClassMap(cmap);

      const res = await queryTable('students');
      setStudents(res.rows || []);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    const internalName = `custom_${Date.now()}`;
    const displayName = newFieldName.trim();
    try {
      await executeSQL(`ALTER TABLE students ADD COLUMN ${internalName} TEXT`);
      await insertRows('custom_fields', [{ field_name: internalName, display_name: displayName }]);
      setNewFieldName('');
      fetchData();
      alert(`'${displayName}' 항목이 추가되었습니다.`);
    } catch (err) {
      console.error('항목 추가 실패:', err);
    }
  };

  const handleDeleteField = async (id: number, fieldName: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      await deleteRows('custom_fields', { ids: [id] });
      fetchData();
    } catch (err) {
      console.error('항목 삭제 실패:', err);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${name} 학생의 정보를 삭제하시겠습니까?`)) return;
    try {
      await deleteRows('students', { ids: [id] });
      setStudents((prev) => prev.filter((s) => s.id !== id));
      alert('삭제되었습니다.');
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  const startEdit = (student: Student) => {
    setEditingStudent(student);
    setNewFaceVector(null);
    setFaceStatus(student.face_vector ? '이미 등록된 얼굴이 있습니다.' : '얼굴 등록이 필요합니다.');
    const initialData: any = {
      name: student.name || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      birth_date: student.birth_date || '',
      rank: student.rank || '',
      memo: student.memo || '',
      class_id: student.class_id || '',
      status: student.status || 'ACTIVE',
      receive_sms_in: student.receive_sms_in !== 'false',
      receive_sms_out: student.receive_sms_out !== 'false'
    };
    customFields.forEach(field => {
      initialData[field.field_name] = student[field.field_name] || '';
    });
    setEditFormData(initialData);
    setClasses([]);
    fetchClasses();
    
    // Increase delay to 1000ms to ensure modal animation is complete
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        startVideo();
      }
    }, 1000);
  };

  const [classes, setClasses] = useState<{id: number, name: string}[]>([]);
  const fetchClasses = async () => {
    try {
      const res = await queryTable('student_classes');
      setClasses(res.rows || []);
    } catch (err) {
      console.error('반 로드 실패:', err);
    }
  };

  const closeEdit = () => {
    stopVideo();
    setEditingStudent(null);
  };

  const handleUpdate = async () => {
    if (!editingStudent || !editFormData.name.trim()) return;
    try {
      const canEnableSms = !!(editingStudent?.face_vector || newFaceVector) && !!(editingStudent?.profile_image || newProfileImage);
      const updateData = { 
        ...editFormData,
        receive_sms_in: (canEnableSms && editFormData.receive_sms_in) ? 'true' : 'false',
        receive_sms_out: (canEnableSms && editFormData.receive_sms_out) ? 'true' : 'false'
      };
      if (newFaceVector) {
        updateData.face_vector = newFaceVector;
      }
      if (newProfileImage) {
        updateData.profile_image = newProfileImage;
      }
      await updateRows('students', updateData, { ids: [editingStudent.id] });
      alert('수정되었습니다.');
      closeEdit();
      fetchData();
    } catch (err) {
      console.error('수정 실패:', err);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  const downloadExcelTemplate = async () => {
    const XLSX = await import('xlsx');
    const headers = ['이름', '생년월일', '학부모성함', '학부모연락처', '급수', '메모', '수련반'];
    customFields.forEach(f => headers.push(f.display_name));
    
    // Get class names for sample
    const classesRes = await queryTable('student_classes');
    const firstClassName = classesRes.rows?.[0]?.name || '초등부 A반';

    const sampleData = [
      headers, 
      ['홍길동', '2015-05-14', '홍판서', '010-1234-5678', '1급', '성실함', firstClassName]
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "관원등록");
    XLSX.writeFile(wb, "관원_등록_양식.xlsx");
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      if (json.length === 0) { alert('데이터가 없습니다.'); return; }
      setImportData(json);
      setShowImporter(true);
    };
    reader.readAsArrayBuffer(file);
  };

  const processImport = async () => {
    try {
      // 현재 등록된 모든 학생 가져오기 (중복 체크용)
      const currentStudentsRes = await queryTable('students');
      const currentStudents = currentStudentsRes.rows || [];
      const existingKeys = new Set(currentStudents.map(s => `${s.name}_${s.birth_date}`));

      // 반 목록 가져오기 (이름 -> ID 매핑용)
      const classesRes = await queryTable('student_classes');
      const classMap: Record<string, number> = {};
      const classRows = classesRes.rows || [];
      classRows.forEach((cls: any) => {
        classMap[cls.name] = cls.id;
      });
      const defaultClassId = classRows[0]?.id || 1;
      
      const newRows: any[] = [];
      let skippedCount = 0;

      importData.forEach(data => {
        const name = data['이름'];
        const birthDate = data['생년월일'];
        if (!name) return; // 이름 없는 행 스킵

        const key = `${name}_${birthDate}`;

        if (existingKeys.has(key)) {
          skippedCount++;
        } else {
          // 반 이름으로 ID 찾기
          const className = data['수련반'];
          const classId = classMap[className] || defaultClassId;

          const row: any = {
            name: name,
            birth_date: birthDate,
            parent_name: data['학부모성함'],
            parent_phone: data['학부모연락처'],
            rank: data['급수'],
            memo: data['메모'],
            class_id: classId,
            status: 'ACTIVE',
            face_vector: null
          };
          customFields.forEach(field => { row[field.field_name] = data[field.display_name]; });
          newRows.push(row);
          existingKeys.add(key); // 파일 내 중복 방지
        }
      });

      if (newRows.length > 0) {
        await insertRows('students', newRows);
      }

      alert(`${newRows.length}명의 관원이 등록되었습니다.${skippedCount > 0 ? `\n(${skippedCount}명은 이미 등록되어 있어 제외되었습니다.)` : ''}`);
      setShowImporter(false);
      fetchData();
    } catch (err) {
      console.error('가져오기 실패:', err);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '40px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.05em' }}>전체 관원 관리</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '16px' }}>
            {[
              { id: 'ACTIVE', label: '재원생' },
              { id: 'ON_HOLD', label: '휴관생' },
              { id: 'DISCHARGED', label: '퇴관생' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: statusFilter === tab.id ? '#FFFFFF' : 'transparent',
                  color: statusFilter === tab.id ? '#2563EB' : '#64748B',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: statusFilter === tab.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }} className="group mr-2">
            <Search 
              size={16} 
              style={{ 
                position: 'absolute', 
                left: '16px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                pointerEvents: 'none',
                color: '#94A3B8'
              }} 
            />
            <input 
              type="text" 
              placeholder="관원명 또는 연락처 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                padding: '12px 24px 12px 48px', 
                backgroundColor: '#FFFFFF', 
                color: '#475569', 
                borderRadius: '16px', 
                border: '1px solid #E2E8F0', 
                fontWeight: 800, 
                fontSize: '14px', 
                width: '240px',
                outline: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                transition: 'all'
              }}
              className="focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
            />
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowImportMenu(!showImportMenu)} style={{ padding: '12px 24px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', fontWeight: 800, fontSize: '14px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={16} /> 일괄 등록
            </button>
            {showImportMenu && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', width: '200px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
                <button onClick={() => { downloadExcelTemplate(); setShowImportMenu(false); }} style={{ width: '100%', padding: '16px', textAlign: 'left', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#2563EB' }}>엑셀 양식 받기</button>
                <label style={{ width: '100%', padding: '16px', textAlign: 'left', display: 'block', cursor: 'pointer', fontWeight: 700, fontSize: '13px', borderTop: '1px solid #F1F5F9' }}>
                  파일 업로드
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { handleFileImport(e); setShowImportMenu(false); }} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>

          <button onClick={() => setShowFieldManager(true)} style={{ padding: '12px 24px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', fontWeight: 800, fontSize: '14px', color: '#475569', cursor: 'pointer' }}>필드 설정</button>
          
          <button onClick={fetchData} style={{ width: '44px', height: '44px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={18} color="#64748B" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-black tracking-widest text-sm">LOADING DATA...</p>
        </div>
      ) : students.filter(s => 
          (s.status === statusFilter || (statusFilter === 'ACTIVE' && !s.status)) &&
          (s.name.includes(searchTerm) || 
          (s.parent_name || '').includes(searchTerm) || 
          (s.parent_phone || '').includes(searchTerm) ||
          (classMap[s.class_id] || '').includes(searchTerm))
        ).length === 0 ? (
        <div className="py-40 text-center bg-white/40 backdrop-blur-xl rounded-[48px] border-2 border-dashed border-white shadow-[0_8px_32px_rgba(0,0,0,0.02)]">
          <div className="flex justify-center mb-4"><Inbox size={48} strokeWidth={1} className="text-slate-400" /></div>
          <p className="text-xl font-black text-slate-400">
            {statusFilter === 'ACTIVE' ? '재원생 중' : statusFilter === 'ON_HOLD' ? '휴관생 중' : '퇴관생 중'} 검색 결과가 없습니다.
          </p>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-2xl rounded-[48px] border border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white">
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">상태 / 이름 / 알림</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">수련반</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">생년월일</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">보호자 정보</th>
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">메모</th>
                  {customFields.map(field => <th key={field.id} className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest">{field.display_name}</th>)}
                  <th className="p-8 font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter(s => {
                    const matchesStatus = (s.status === statusFilter || (statusFilter === 'ACTIVE' && !s.status));
                    if (!matchesStatus) return false;
                    
                    if (!searchTerm) return true;
                    
                    return (
                      matchChosung(s.name || '', searchTerm) ||
                      matchChosung(s.parent_name || '', searchTerm) ||
                      (s.parent_phone || '').includes(searchTerm) ||
                      matchChosung(classMap[s.class_id] || '', searchTerm)
                    );
                  })
                  .map((student) => (
                  <tr key={student.id} className={`group border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${student.status !== 'ACTIVE' && student.status ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                    <td className="p-8">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1 items-center">
                          <div 
                            onClick={() => student.profile_image && setPreviewImage(student.profile_image)}
                            className={`w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 ${student.profile_image ? 'cursor-pointer hover:border-blue-500 hover:scale-105 active:scale-95 transition-all' : ''}`}
                            title={student.profile_image ? "원본 보기" : ""}
                          >
                            {student.profile_image ? (
                              <img src={student.profile_image} className="w-full h-full object-cover" alt={student.name} />
                            ) : (
                              <User size={24} strokeWidth={1.5} className="text-slate-400" />
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-slate-900 text-lg leading-none">{student.name}</p>
                            {student.status === 'ON_HOLD' ? (
                              <span className="text-[10px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md">휴관</span>
                            ) : student.status === 'DISCHARGED' ? (
                              <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-md">퇴관</span>
                            ) : (
                              <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">재원</span>
                            )}
                          </div>
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{student.rank || '일반'}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 ml-3 border-l border-slate-100 pl-3">
                          {student.receive_sms_in === 'true' && (
                            <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, whiteSpace: 'nowrap', display: 'inline-block', textAlign: 'center' }}>
                              등원 알림
                            </span>
                          )}
                          {student.receive_sms_out === 'true' && (
                            <span style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, whiteSpace: 'nowrap', display: 'inline-block', textAlign: 'center' }}>
                              하원 알림
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-8 font-black text-blue-600">
                      <span className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{classMap[student.class_id] || '미배정'}</span>
                    </td>
                    <td className="p-8 font-bold text-slate-600">{student.birth_date || '-'}</td>
                    <td className="p-8">
                      <p className="font-bold text-slate-700">{student.parent_name || '-'}</p>
                      <p className="text-xs font-medium text-slate-400">{student.parent_phone || '-'}</p>
                    </td>
                    <td className="p-8">
                      <p className="text-sm text-slate-500 font-medium max-w-[200px] truncate">{student.memo || '-'}</p>
                    </td>
                    {customFields.map(field => <td key={field.id} className="p-8 text-slate-600 font-medium">{student[field.field_name] || '-'}</td>)}
                    <td className="p-8">
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button 
                          onClick={() => startEdit(student)} 
                          style={{ 
                            width: '44px', 
                            height: '44px', 
                            backgroundColor: '#0F172A', 
                            color: '#FFFFFF', 
                            borderRadius: '12px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            border: 'none', 
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          title="정보 수정"
                        >
                          <ClipboardEdit size={20} />
                        </button>
                        <button 
                          onClick={() => handleDelete(student.id, student.name)} 
                          style={{ 
                            width: '44px', 
                            height: '44px', 
                            backgroundColor: '#FEE2E2', 
                            color: '#EF4444', 
                            borderRadius: '12px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            border: '1px solid #FECACA', 
                            cursor: 'pointer'
                          }}
                          title="삭제"
                        >
                          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>✕</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom Field Manager Modal */}
      {showFieldManager && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white/90 backdrop-blur-2xl w-full max-w-md rounded-[48px] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] animate-in zoom-in duration-200 border border-white">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">항목 설정</h2>
              <button onClick={() => setShowFieldManager(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">✕</button>
            </div>
            <div className="space-y-8">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">새 항목 추가</label>
                <div className="flex gap-2">
                  <input type="text" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} className="flex-1 bg-white border-2 border-slate-200 rounded-2xl px-5 py-3 outline-none focus:border-blue-500 font-bold transition-all" placeholder="예: 주소, 소속 등" />
                  <button onClick={handleAddField} className="bg-blue-600 text-white px-6 rounded-2xl font-black hover:bg-blue-700 active:scale-95 transition-all">추가</button>
                </div>
              </div>
              <div className="space-y-4">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">현재 사용 중인 항목</label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {customFields.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-300 font-bold text-sm">추가된 항목이 없습니다.</p>
                    </div>
                  ) : (
                    customFields.map(field => (
                      <div key={field.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                        <span className="font-black text-slate-700">{field.display_name}</span>
                        <button onClick={() => handleDeleteField(field.id, field.field_name)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Preview Modal */}
      {showImporter && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-50 flex items-center justify-center p-6">
          <div className="bg-white/90 backdrop-blur-2xl w-full max-w-5xl rounded-[48px] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] animate-in zoom-in duration-300 border border-white flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">가져오기 데이터 미리보기</h2>
                <p className="text-slate-500 font-medium">데이터를 검토하고 최종 승인해 주세요.</p>
              </div>
              <button onClick={() => setShowImporter(false)} className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all">✕</button>
            </div>
            
            <div className="flex-1 overflow-auto border-2 border-slate-100 rounded-[32px] mb-8 bg-slate-50/50 shadow-inner">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                  <tr>
                    {Object.keys(importData[0] || {}).map(k => (
                      <th key={k} className="p-6 border-b border-slate-100 font-black text-slate-400 uppercase tracking-tighter text-xs">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importData.map((row, i) => (
                    <tr key={i} className="hover:bg-white transition-colors">
                      {Object.values(row).map((v: any, j) => (
                        <td key={j} className="p-6 border-b border-slate-50 text-slate-600 font-bold">{v || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#0F172A', padding: '32px', borderRadius: '40px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '56px', height: '56px', backgroundColor: '#2563EB', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 10px 15px -3px rgba(37,99,235,0.4)' }}>📥</div>
                  <div>
                    <p style={{ color: '#FFFFFF', fontWeight: 900, fontSize: '20px', margin: 0, letterSpacing: '-0.025em' }}>총 {importData.length}명의 데이터를 확인했습니다.</p>
                    <p style={{ color: '#94A3B8', fontSize: '14px', fontWeight: 500, margin: '4px 0 0 0' }}>중복된 관원은 자동으로 제외됩니다.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowImporter(false)} style={{ padding: '16px 32px', backgroundColor: '#1E293B', color: '#94A3B8', borderRadius: '16px', fontWeight: 900, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>취소</button>
                  <button onClick={processImport} style={{ padding: '16px 48px', backgroundColor: '#2563EB', color: '#FFFFFF', borderRadius: '16px', fontWeight: 900, border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(37,99,235,0.3)', transition: 'all 0.2s' }}>승인 및 데이터 병합</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Edit Student Modal */}
      {editingStudent && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(15, 23, 42, 0.7)', 
          backdropFilter: 'blur(12px)', 
          zIndex: 9999, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '24px' 
        }}>
          <div className="bg-white rounded-[56px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-white overflow-hidden animate-in zoom-in duration-300" style={{ width: '90%', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'row' }}>
            {/* Left: Form Fields */}
            <div style={{ flex: 1.4, padding: '60px', overflowY: 'auto', backgroundColor: '#FFFFFF' }} className="custom-scrollbar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
                <div>
                  <h2 style={{ fontSize: '40px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.05em' }}>관원 정보 수정</h2>
                  <p style={{ color: '#64748B', fontWeight: 700, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: '#3B82F6', borderRadius: '50%' }}></span>
                    PROFILE UPDATE: {editingStudent.name}
                  </p>
                </div>
                <button onClick={closeEdit} style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: '16px', border: 'none', cursor: 'pointer', color: '#64748B' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">학생 이름 *</label>
                  <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">생년월일</label>
                  <input type="text" value={editFormData.birth_date} onChange={(e) => setEditFormData({...editFormData, birth_date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all" placeholder="YYYY-MM-DD" />
                </div>
                <div className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">학부모 성함</label>
                  <input type="text" value={editFormData.parent_name} onChange={(e) => setEditFormData({...editFormData, parent_name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">학부모 연락처</label>
                  <input type="text" value={editFormData.parent_phone} onChange={(e) => setEditFormData({...editFormData, parent_phone: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all" placeholder="010-0000-0000" />
                </div>
                {(() => {
                  const canEnableSms = !!(editingStudent?.face_vector || newFaceVector) && !!(editingStudent?.profile_image || newProfileImage);
                  return (
                    <div className="flex flex-col gap-2 group">
                      <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        알림 문자 설정
                        {!canEnableSms && <span className="text-red-400 text-[10px] normal-case tracking-normal">(사진 및 AI 등록 필요)</span>}
                      </label>
                      <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 transition-all shadow-sm h-[56px] box-border ${canEnableSms ? 'hover:bg-slate-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            disabled={!canEnableSms}
                            checked={canEnableSms && editFormData.receive_sms_in}
                            onChange={(e) => setEditFormData({...editFormData, receive_sms_in: e.target.checked})}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="font-bold text-slate-700 text-sm whitespace-nowrap">등원 받기</span>
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 transition-all shadow-sm h-[56px] box-border ${canEnableSms ? 'hover:bg-slate-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            disabled={!canEnableSms}
                            checked={canEnableSms && editFormData.receive_sms_out}
                            onChange={(e) => setEditFormData({...editFormData, receive_sms_out: e.target.checked})}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="font-bold text-slate-700 text-sm whitespace-nowrap">하원 받기</span>
                        </label>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">급/단</label>
                  <input type="text" value={editFormData.rank} onChange={(e) => setEditFormData({...editFormData, rank: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">반 선택</label>
                  <select value={editFormData.class_id} onChange={(e) => setEditFormData({...editFormData, class_id: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer">
                    {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>

                {customFields.map(field => (
                  <div key={field.id} className="flex flex-col gap-2 group">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{field.display_name}</label>
                    <input type="text" value={editFormData[field.field_name] || ''} onChange={(e) => setEditFormData({...editFormData, [field.field_name]: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm" />
                  </div>
                ))}

                <div className="flex flex-col gap-2 col-span-1 md:col-span-2 group">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">메모</label>
                  <textarea value={editFormData.memo} onChange={(e) => setEditFormData({...editFormData, memo: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 h-32 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none shadow-sm" placeholder="기타 특이사항" />
                </div>

                <div className="col-span-1 md:col-span-2 flex flex-col gap-4 mt-4 p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Settings size={14} /> 관원 상태 관리
                  </label>
                  <div className="flex gap-3">
                    {[
                      { id: 'ACTIVE', label: '재원 처리 (복관)', color: '#2563EB', activeBg: '#DBEAFE' },
                      { id: 'ON_HOLD', label: '휴관 처리', color: '#D97706', activeBg: '#FEF3C7' },
                      { id: 'DISCHARGED', label: '퇴관 처리', color: '#DC2626', activeBg: '#FEE2E2' }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          if (confirm(`'${btn.label}' 하시겠습니까?`)) {
                            setEditFormData({ ...editFormData, status: btn.id });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '16px',
                          borderRadius: '16px',
                          border: (editFormData.status || 'ACTIVE') === btn.id ? `2px solid ${btn.color}` : '2px solid #E2E8F0',
                          backgroundColor: (editFormData.status || 'ACTIVE') === btn.id ? btn.activeBg : '#FFFFFF',
                          color: (editFormData.status || 'ACTIVE') === btn.id ? btn.color : '#64748B',
                          fontWeight: 900,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {(editFormData.status || 'ACTIVE') === btn.id && <CheckCircle2 size={16} />}
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1 font-bold italic">* 상태 변경 후 우측 상단의 '정보 수정 완료' 버튼을 눌러야 최종 저장됩니다.</p>
                </div>
              </div>
            </div>

            {/* Right: AI Update Area */}
            <div style={{ flex: 1, backgroundColor: '#0F172A', padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
              <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-blue-600/20 blur-[100px] rounded-full"></div>
              
              <div className="relative z-10 space-y-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-white tracking-tight">AI 얼굴 정보 수정</h3>
                  <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${faceStatus.includes('성공') ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {faceStatus.includes('성공') ? '분석 완료' : '인식 대기중'}
                  </div>
                </div>

                <div className="aspect-video bg-black rounded-[40px] overflow-hidden relative border border-white/10 shadow-2xl group ring-1 ring-white/5">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    style={{ 
                      transform: `scaleX(-1) scale(${zoom})`, 
                      transformOrigin: 'center',
                      display: (pendingCapture || (newProfileImage && !isCapturing)) ? 'none' : 'block' 
                    }} 
                    className="w-full h-full object-cover opacity-90 transition-transform duration-200" 
                  />
                  <canvas 
                    ref={canvasRef} 
                    style={{ 
                      transform: `scaleX(-1) scale(${zoom})`, 
                      transformOrigin: 'center',
                      display: (pendingCapture || (newProfileImage && !isCapturing)) ? 'none' : 'block' 
                    }} 
                    className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-200 pointer-events-none" 
                  />
                  {(pendingCapture || (newProfileImage && !isCapturing)) && (
                    <img src={pendingCapture ? pendingCapture.image : (newProfileImage || '')} className="w-full h-full object-cover" alt="Captured" />
                  )}
                  {isCapturing && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
                        <span className="text-white text-[10px] font-black tracking-[0.2em]">ANALYZING...</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,1)] animate-scan z-10"></div>
                </div>

                {/* Zoom Slider */}
                {(!pendingCapture && !(newProfileImage && !isCapturing)) && (
                  <div className="flex items-center gap-4 bg-[#1E293B] p-4 rounded-2xl border border-white/5">
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
                )}

                <div className="space-y-6">
                  {pendingCapture ? (
                    <div className="flex gap-4">
                      <button onClick={confirmCapture} className="flex-1 bg-blue-600 text-white py-6 rounded-[24px] font-black text-lg hover:bg-blue-500 active:scale-95 transition-all shadow-xl">
                        이 사진 사용하기
                      </button>
                      <button onClick={rejectCapture} className="flex-1 bg-slate-700 text-white py-6 rounded-[24px] font-black text-lg hover:bg-slate-600 active:scale-95 transition-all shadow-xl">
                        다시 촬영
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleCaptureFace} disabled={isCapturing} className="w-full bg-white text-slate-900 py-6 rounded-[24px] font-black text-lg hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl">
                      <Camera size={24} /> {editingStudent.face_vector ? '얼굴 다시 촬영' : '새 얼굴 촬영'}
                    </button>
                  )}
                  <p className="text-slate-500 text-[11px] text-center font-bold leading-relaxed uppercase tracking-wider">
                    정면을 응시하면 자동으로 특징을 분석합니다.<br/>촬영된 사진은 프로필로 자동 등록됩니다.
                  </p>
                </div>
              </div>

              <div className="relative z-10 pt-10 flex flex-col gap-5">
                <button onClick={handleUpdate} className="w-full bg-blue-600 text-white py-6 rounded-[32px] font-black text-xl hover:bg-blue-500 shadow-[0_25px_50px_-12px_rgba(37,99,235,0.4)] active:scale-95 transition-all border border-blue-400/20">수정 내용 저장하기</button>
                <button onClick={closeEdit} className="w-full py-4 text-slate-500 font-black hover:text-slate-300 transition-colors uppercase tracking-widest text-[11px]">수정 취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl w-full flex items-center justify-center">
            <img 
              src={previewImage} 
              className="max-w-full max-h-[90vh] rounded-[48px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] border-4 border-white/10 animate-in zoom-in-95 duration-300" 
              alt="Preview" 
            />
            <button className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white font-black transition-all flex items-center justify-center">✕</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 4s ease-in-out infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </div>
  );
}
