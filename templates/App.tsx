import React, { useState, useRef, useEffect } from 'react';
import { extractTableFromImage } from './services/geminiService';
import { fileToBase64, generateAndDownloadExcel, formatFileSize } from './utils/fileHelpers';
import { ExtractedTableData, ProcessingStatus } from './types';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, MotionValue } from 'framer-motion';
import { 
  CloudArrowUpIcon, 
  TableCellsIcon, 
  ArrowPathIcon, 
  ArrowDownTrayIcon, 
  DocumentChartBarIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const LOADING_MESSAGES = [
  "Analyzing image structure...",
  "Detecting table boundaries...",
  "Recognizing text via OCR...",
  "Formatting data cells...",
  "Finalizing Excel structure..."
];

// Floating Particle Component
const Particle: React.FC<{ delay: number; x: number }> = ({ delay, x }) => (
  <motion.div
    initial={{ y: "110vh", opacity: 0, scale: 0.5 }}
    animate={{ 
      y: "-10vh", 
      opacity: [0, 0.6, 0],
      scale: [0.5, 1.5, 0.5],
      rotate: [0, 180],
    }}
    transition={{
      duration: Math.random() * 15 + 15,
      repeat: Infinity,
      delay: delay,
      ease: "linear",
    }}
    style={{ left: `${x}%` }}
    className="absolute w-1 h-1 bg-cyan-400/40 rounded-full blur-[1px] shadow-[0_0_10px_rgba(34,211,238,0.5)]"
  />
);

type MascotState = 'idle' | 'processing' | 'success' | 'celebrating';

interface RoboMascotProps {
  layoutId: string;
  state: MascotState;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  className?: string;
}

// Robot Mascot
const RoboMascot: React.FC<RoboMascotProps> = ({ layoutId, state, mouseX, mouseY, className }) => {
  const springX = useSpring(mouseX, { stiffness: 100, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 100, damping: 20 });
  const eyeX = useTransform(springX, [0, window.innerWidth || 1920], [-3, 3]);
  const eyeY = useTransform(springY, [0, window.innerHeight || 1080], [-4, 2]);

  return (
    <motion.div
      layoutId={layoutId}
      className={`z-50 pointer-events-none ${className}`}
      initial={false}
      animate={state === 'celebrating' ? { 
        y: [0, -30, 0], rotate: [0, 360, 0], scale: [1, 1.2, 1] 
      } : { 
        y: [0, -8, 0],
        rotate: state === 'processing' ? [0, 2, -2, 0] : [-2, 2, -2],
      }}
      transition={state === 'celebrating' ? { duration: 0.8 } : { 
        y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: state === 'processing' ? 0.5 : 4, repeat: Infinity }
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_10px_20px_rgba(99,102,241,0.4)] overflow-visible">
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <motion.g animate={state === 'processing' ? { rotate: [-10, 10, -10] } : { rotate: [-5, 5, -5] }} style={{ originX: "50px", originY: "50px" }} transition={{ duration: state === 'processing' ? 0.2 : 2, repeat: Infinity }}>
          <line x1="50" y1="30" x2="50" y2="5" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />
          <motion.circle cx="50" cy="5" r="4" fill={state === 'success' || state === 'celebrating' ? "#4ade80" : "#fbbf24"} filter="url(#glow)" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
        </motion.g>
        <rect x="22" y="30" width="56" height="45" rx="14" fill="url(#bodyGrad)" stroke="#c4b5fd" strokeWidth="2" />
        <rect x="30" y="38" width="40" height="24" rx="8" fill="#1e1b4b" />
        <g fill="#22d3ee" filter="url(#glow)">
          {state === 'success' || state === 'celebrating' ? (
             <g stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" fill="none">
                <path d="M36 50 Q40 45 44 50" /><path d="M56 50 Q60 45 64 50" />
             </g>
          ) : (
            <>
              <motion.ellipse cx="42" cy="50" rx="4" ry={state === 'processing' ? 2 : 5} style={{ x: eyeX, y: eyeY }} />
              <motion.ellipse cx="58" cy="50" rx="4" ry={state === 'processing' ? 2 : 5} style={{ x: eyeX, y: eyeY }} />
            </>
          )}
        </g>
        <motion.path d="M46 58 Q50 60 54 58" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" animate={state === 'success' || state === 'celebrating' ? { d: "M44 58 Q50 63 56 58", opacity: 1 } : { d: "M46 58 Q50 60 54 58", opacity: 0.6 }} />
        <motion.circle cx="12" cy="55" r="9" fill="#6366f1" stroke="#c4b5fd" strokeWidth="1.5" animate={state === 'processing' ? { y: [5, -5, 5], x: [0, 2, 0] } : state === 'celebrating' ? { y: -15 } : { y: [3, -3, 3] }} transition={{ duration: state === 'processing' ? 0.3 : 1.5, repeat: Infinity, delay: 0.2 }} />
        <motion.circle cx="88" cy="55" r="9" fill="#6366f1" stroke="#c4b5fd" strokeWidth="1.5" animate={state === 'processing' ? { y: [-5, 5, -5], x: [0, -2, 0] } : state === 'celebrating' ? { y: -15 } : { y: [-3, 3, -3] }} transition={{ duration: state === 'processing' ? 0.3 : 1.5, repeat: Infinity, delay: 0.5 }} />
      </svg>
    </motion.div>
  );
};

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [tableData, setTableData] = useState<ExtractedTableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3D Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [0, window.innerHeight], [2, -2]), { stiffness: 50, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, window.innerWidth], [-2, 2]), { stiffness: 50, damping: 20 });
  const handleMouseMove = (e: React.MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };

  useEffect(() => {
    let interval: number;
    if (status === ProcessingStatus.PROCESSING) {
      setLoadingMsgIndex(0);
      interval = window.setInterval(() => setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length), 2000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) { setError("Please upload a valid image file."); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError("File size exceeds 10MB limit."); return; }
    setFile(selectedFile); setPreviewUrl(URL.createObjectURL(selectedFile)); setError(null);
    setStatus(ProcessingStatus.IDLE); setTableData(null); setMascotState('idle');
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); };

  const handleProcessImage = async () => {
    if (!file) return;
    setStatus(ProcessingStatus.PROCESSING); setMascotState('processing'); setError(null);
    try {
      const base64 = await fileToBase64(file);
      const data = await extractTableFromImage(base64, file.type);
      setTableData(data); setStatus(ProcessingStatus.SUCCESS); setMascotState('success');
    } catch (err: any) {
      console.error(err); setError(err.message || "Failed."); setStatus(ProcessingStatus.ERROR); setMascotState('idle');
    }
  };

  const handleReset = () => {
    setFile(null); setPreviewUrl(null); setTableData(null); setStatus(ProcessingStatus.IDLE);
    setError(null); setMascotState('idle'); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (tableData) {
      setMascotState('celebrating');
      generateAndDownloadExcel(tableData, file ? file.name.split('.')[0] : 'table_data');
      setTimeout(() => { setMascotState('idle'); setTimeout(() => handleReset(), 600); }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden relative" onMouseMove={handleMouseMove}>
      
      {/* Background System */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none perspective-[1000px]">
        <div className="absolute inset-0 bg-[#0B1121]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <motion.div animate={{ scale: [1, 1.2, 1], x: [-50, 50, -50], y: [-30, 30, -30], rotateX: [0, 20, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen" />
        <motion.div animate={{ scale: [1, 1.3, 1], x: [30, -30, 30], y: [20, -50, 20] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-teal-600/10 rounded-full blur-[130px] mix-blend-screen" />
        <div className="absolute inset-0 transform-style-3d"> {[...Array(15)].map((_, i) => <Particle key={i} delay={i * 2} x={Math.random() * 100} />)} </div>
      </div>
      
      {/* Navbar with NAME ADDED */}
      <nav className="border-b border-slate-800/60 bg-[#0B1121]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Left Side: Logo + Name */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
              <motion.div whileHover={{ rotateZ: 15, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }} className="bg-indigo-600/90 p-2 rounded-lg shadow-lg shadow-indigo-500/20 backdrop-blur-sm">
                <DocumentChartBarIcon className="h-6 w-6 text-white" />
              </motion.div>
              
              <div className="flex flex-col justify-center">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 leading-none mb-0.5">
                  VisionSheet
                </span>
                {/* YOUR NAME IS HERE - PERMANENT STYLE */}
                <span className="text-[10px] text-slate-500 font-medium tracking-widest uppercase select-none pointer-events-none">
                  Chinmaygouda Patil
                </span>
              </div>
            </motion.div>

            {/* Right Side */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-slate-400 hidden sm:flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-amber-400 animate-pulse" />
              Powered by Gemini 2.5 Flash
            </motion.div>
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 py-8 sm:py-12 flex flex-col items-center relative z-10 perspective-[1200px]" style={{ perspective: 1200 }}>
        
        {/* Header Section */}
        <motion.div initial={{ opacity: 0, y: 30, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.8, type: "spring", bounce: 0.4 }} className="text-center max-w-2xl mb-10 transform-style-3d relative z-20">
          <div className="relative inline-block">
            {mascotState === 'idle' && <RoboMascot layoutId="mascot" state={mascotState} mouseX={x} mouseY={y} className="absolute -top-16 -right-6 sm:-right-20 sm:-top-12 w-20 h-20 sm:w-28 sm:h-28" />}
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight drop-shadow-2xl">
              Turn <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Pixels</span> into <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Excel</span>
            </h1>
          </div>
          <p className="text-lg text-slate-400">Advanced AI extraction for your tables. Just drop an image, and watch the magic happen instantly.</p>
        </motion.div>

        {/* Main Card with 3D Tilt */}
        <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="w-full max-w-6xl relative">
          <motion.div initial={{ opacity: 0, scale: 0.9, z: -100 }} animate={{ opacity: 1, scale: 1, z: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-md transform-style-3d">
            <div className="p-6 sm:p-8 transform-style-3d">
              <AnimatePresence mode="wait" initial={false}>
              {!file ? (
                // Upload Area
                <motion.div key="upload" initial={{ opacity: 0, rotateY: -90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 90 }} transition={{ duration: 0.5, ease: "easeInOut" }} className="relative group cursor-pointer transform-style-3d" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.01, z: 20 }} whileTap={{ scale: 0.99, z: 10 }}>
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                  <div className={`relative border-2 border-dashed rounded-xl p-16 text-center transition-all duration-300 backdrop-blur-sm transform-style-3d ${isDragging ? 'border-indigo-400 bg-slate-800/90 shadow-[0_0_30px_rgba(99,102,241,0.3)] scale-[1.02] translate-z-10' : 'border-slate-600 bg-slate-900/80 hover:bg-slate-900/90 hover:border-indigo-500/50'}`}>
                    <motion.div animate={isDragging ? { scale: 1.1, y: -5, z: 30 } : { y: [0, -10, 0], z: 0 }} transition={isDragging ? { duration: 0.2 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }} className="transform-style-3d" style={{ translateZ: 30 }}>
                      <CloudArrowUpIcon className={`h-20 w-20 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(129,140,248,0.3)] transition-colors duration-300 ${isDragging ? 'text-indigo-300' : 'text-indigo-400'}`} />
                    </motion.div>
                    <h3 className="text-2xl font-semibold text-white mb-2" style={{ transform: "translateZ(20px)" }}>{isDragging ? 'Drop Image Here' : 'Drag & Drop Image'}</h3>
                    <p className="text-slate-400 text-base mb-8" style={{ transform: "translateZ(10px)" }}>{isDragging ? 'Release to upload' : 'or click to browse your files'}</p>
                    <motion.span style={{ transform: "translateZ(25px)" }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className={`inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-8 rounded-full transition-all shadow-lg shadow-indigo-500/30 text-sm ${isDragging ? 'pointer-events-none opacity-50' : ''}`}>Select File</motion.span>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                  </div>
                </motion.div>
              ) : (
                // Workspace
                <motion.div key="workspace" initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} transition={{ duration: 0.5, ease: "easeInOut" }} className="grid grid-cols-1 lg:grid-cols-2 gap-8 transform-style-3d">
                  {/* Left Column */}
                  <div className="flex flex-col gap-4 transform-style-3d">
                    <div className="flex items-center justify-between" style={{ transform: "translateZ(10px)" }}>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><div className="w-2 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>Source Image</h3>
                      {status !== ProcessingStatus.PROCESSING && (<button onClick={handleReset} className="text-sm text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors px-3 py-1 rounded-full hover:bg-slate-700/50"><XMarkIcon className="h-4 w-4" /> Reset</button>)}
                    </div>
                    
                    <motion.div layoutId="image-container" className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900/50 group shadow-inner min-h-[400px] flex items-center justify-center transform-style-3d" style={{ transform: "translateZ(20px)" }}>
                      <img src={previewUrl!} alt="Preview" className={`w-full h-auto object-contain max-h-[500px] transition-all duration-700 ${status === ProcessingStatus.PROCESSING ? 'opacity-50 grayscale scale-105' : ''}`} />
                      <AnimatePresence>
                        {status === ProcessingStatus.PROCESSING && (
                          <motion.div className="absolute inset-0 z-20 pointer-events-none overflow-hidden transform-style-3d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                             <motion.div className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.9),0_10px_20px_rgba(34,211,238,0.5)] z-10" animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} style={{ transform: "translateZ(30px)" }} />
                             <motion.div className="absolute left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/20 to-transparent" animate={{ top: ['-5%', '95%', '-5%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} style={{ transform: "rotateX(20deg) translateZ(10px)" }} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md p-3 border-t border-slate-700 flex justify-between items-center z-30" style={{ transform: "translateZ(25px)" }}>
                        <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">{formatFileSize(file.size)}</span>
                      </div>
                    </motion.div>

                    {status === ProcessingStatus.IDLE && (
                      <motion.button whileHover={{ scale: 1.02, z: 10, boxShadow: "0 10px 30px rgba(79, 70, 229, 0.4)" }} whileTap={{ scale: 0.98, z: 0 }} onClick={handleProcessImage} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 group relative overflow-hidden transform-style-3d" style={{ transform: "translateZ(10px)" }}>
                        <span className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span><TableCellsIcon className="h-5 w-5" />Convert to Excel
                      </motion.button>
                    )}

                    {status === ProcessingStatus.PROCESSING && (
                      <div className="relative w-full py-4 bg-slate-800/50 rounded-xl flex flex-col items-center justify-center gap-2 border border-slate-700/50 transform-style-3d" style={{ transform: "translateZ(10px)" }}>
                        {mascotState === 'processing' && <RoboMascot layoutId="mascot" state={mascotState} mouseX={x} mouseY={y} className="absolute -top-12 right-1/2 translate-x-1/2 w-16 h-16" />}
                        <div className="flex items-center gap-3"><ArrowPathIcon className="h-5 w-5 animate-spin text-cyan-400" />
                          <AnimatePresence mode="wait"><motion.span key={loadingMsgIndex} initial={{ opacity: 0, y: 10, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -10, rotateX: 20 }} className="text-cyan-300 font-medium min-w-[200px] text-center">{LOADING_MESSAGES[loadingMsgIndex]}</motion.span></AnimatePresence>
                        </div>
                        <div className="w-64 h-1 bg-slate-700 rounded-full mt-2 overflow-hidden"><motion.div className="h-full bg-cyan-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 10, ease: "linear" }} /></div>
                      </div>
                    )}
                    
                    {error && <motion.div initial={{ opacity: 0, scale: 0.9, rotateX: -20 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400" style={{ transform: "translateZ(10px)" }}><ExclamationCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" /><span className="text-sm">{error}</span></motion.div>}
                  </div>

                  {/* Right Column: Results */}
                  <div className="flex flex-col gap-4 h-full transform-style-3d">
                     <div className="flex items-center justify-between" style={{ transform: "translateZ(10px)" }}>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><div className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>Extracted Data</h3>
                      {status === ProcessingStatus.SUCCESS && <motion.span initial={{ opacity: 0, scale: 0, z: -20 }} animate={{ opacity: 1, scale: 1, z: 0 }} className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> Success</motion.span>}
                    </div>

                    <div className="flex-grow bg-[#0f172a] border border-slate-700 rounded-xl overflow-hidden relative min-h-[300px] shadow-inner flex flex-col transform-style-3d" style={{ transform: "translateZ(15px)" }}>
                      {!tableData ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-8 text-center bg-slate-900/50">
                           {status === ProcessingStatus.PROCESSING ? (
                             <div className="flex flex-col items-center">
                               <div className="w-20 h-20 relative transform-style-3d">
                                 <div className="absolute inset-0 border-4 border-slate-700 rounded-xl"></div>
                                 <motion.div className="absolute inset-0 border-4 border-cyan-500 rounded-xl" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0 0 0)' }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} style={{ transform: "translateZ(10px)" }} />
                               </div>
                               <p className="mt-6 text-slate-400 font-light" style={{ transform: "translateZ(10px)" }}>Synthesizing table data...</p>
                             </div>
                           ) : (
                             <>
                               <div className="bg-slate-800 p-6 rounded-full mb-4" style={{ transform: "translateZ(10px)" }}><TableCellsIcon className="h-12 w-12 text-slate-500" /></div>
                               <p className="text-lg" style={{ transform: "translateZ(5px)" }}>Data preview will appear here</p>
                               <p className="text-sm text-slate-500 mt-2">Upload an image to start extracting</p>
                             </>
                           )}
                        </div>
                      ) : (
                        <div className="flex-grow overflow-auto custom-scrollbar">
                          <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs uppercase bg-slate-800 text-slate-400 sticky top-0 z-10 shadow-sm"><tr>{tableData.headers.map((header, idx) => <th key={idx} className="px-6 py-4 border-b border-slate-700 whitespace-nowrap font-semibold tracking-wider">{header}</th>)}</tr></thead>
                            <tbody>{tableData.rows.map((row, rowIdx) => <motion.tr key={rowIdx} initial={{ opacity: 0, x: -20, rotateX: 10 }} animate={{ opacity: 1, x: 0, rotateX: 0 }} transition={{ delay: rowIdx * 0.05 }} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors group">{row.map((cell, cellIdx) => <td key={cellIdx} className="px-6 py-3 whitespace-nowrap group-hover:text-white transition-colors">{cell}</td>)}</motion.tr>)}</tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Summary & Download */}
                    {tableData && (
                      <motion.div initial={{ opacity: 0, y: 20, z: -20 }} animate={{ opacity: 1, y: 0, z: 0 }} className="flex flex-col gap-3 transform-style-3d relative" style={{ transform: "translateZ(10px)" }}>
                        {(mascotState === 'success' || mascotState === 'celebrating') && <RoboMascot layoutId="mascot" state={mascotState} mouseX={x} mouseY={y} className="absolute -top-16 right-0 w-16 h-16 z-50" />}
                        {tableData.summary && <div className="text-sm text-slate-300 bg-slate-800/80 p-4 rounded-xl border-l-4 border-indigo-500 shadow-lg transform-style-3d"><span className="text-indigo-400 font-bold block mb-1 uppercase text-xs tracking-wider">AI Summary</span>{tableData.summary}</div>}
                        <motion.button whileHover={{ scale: 1.02, z: 10, boxShadow: "0 10px 30px rgba(16, 185, 129, 0.4)" }} whileTap={{ scale: 0.98, z: 0 }} onClick={handleDownload} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 group transform-style-3d" style={{ transform: "translateZ(10px)" }}>
                          <ArrowDownTrayIcon className="h-5 w-5 group-hover:animate-bounce" />Download Excel File
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </main>

      <footer className="py-6 text-center text-slate-500 text-sm border-t border-slate-800 bg-[#0B1121] relative z-10">
        <p>© 2025 VisionSheet. Powered by Google Gemini 2.5 Flash.</p>
      </footer>
    </div>
  );
};

export default App;