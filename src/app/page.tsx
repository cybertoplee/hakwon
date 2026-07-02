import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-8 bg-slate-50/50 rounded-[48px] m-4">
      <div className="text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 w-full max-w-5xl mx-auto">
        
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter">
            일도킥복싱 멀티짐 <span className="text-blue-600">출결관리 시스템</span>
          </h1>
          <p className="text-xl text-slate-500 font-bold tracking-tight">
            가장 스마트한 인공지능 기반 도장 출결 솔루션
          </p>
        </div>

        <div className="relative w-full aspect-[16/9] mx-auto rounded-[40px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border-8 border-white group">
          <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-transparent transition-colors z-10 pointer-events-none"></div>
          <Image 
            src="/egdesk-hero.png" 
            alt="EGDESK Dashboard Illustration" 
            fill 
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
        </div>
        
      </div>
    </div>
  );
}
