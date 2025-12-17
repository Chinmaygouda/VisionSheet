import React, { useState, useRef, useEffect } from 'react';
import { extractTableFromImage } from './services/geminiService';
import { fileToBase64, generateAndDownloadExcel, formatFileSize, parseExcelFile } from './utils/fileHelpers';
import { ExtractedTableData, ProcessingStatus } from './types';
import { motion, AnimatePresence, MotionValue, useSpring, useTransform } from 'framer-motion';
import { 
  CloudArrowUpIcon, 
  TableCellsIcon, 
  ArrowPathIcon, 
  ArrowDownTrayIcon, 
  DocumentChartBarIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  DocumentPlusIcon,
  PhotoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Square3Stack3DIcon
} from '@heroicons/react/24/outline';

const LOADING_MESSAGES = [
  "Analyzing image structure...",
  "Detecting table boundaries...",
  "Recognizing text via OCR...",
  "Formatting data cells...",
  "Finalizing Excel structure..."
];

// Simple Background Particle
const Particle: React.FC<{ delay: number; x: number }> = ({ delay, x }) => (
  <motion.div
    initial={{ y: "110vh", opacity: 0, scale: 0.5 }}
    animate={{ y: "-10vh", opacity: [0, 0.6, 0], scale: [0.5, 1.5, 0.5], rotate: [0, 180] }}
    transition={{ duration: Math.random() * 15 + 15, repeat: Infinity, delay: delay, ease: "linear" }}
    style={{ left: `${x}%` }}
    className="absolute w-1 h-1 bg-cyan-400/40 rounded-full blur-[1px]"
  />
);

type MascotState = 'idle' | 'processing' | 'success' | 'celebrating';

interface RoboMascotProps { layoutId: string; state: MascotState; className?: string; }

const RoboMascot: React.FC<RoboMascotProps> = ({ layoutId, state, className }) => {
  return (
    <motion.div layoutId={layoutId} className={`z-50 pointer-events-none ${className}`} initial={false}
      animate={state === 'celebrating' ? { y: [0, -30, 0], rotate: [0, 360, 0], scale: [1, 1.2, 1] } : { y: [0, -8, 0], rotate: state === 'processing' ? [0, 2, -2, 0] : [-2, 2, -2] }}
      transition={state === 'celebrating' ? { duration: 0.8 } : { y: { duration: 3, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: state === 'processing' ? 0.5 : 4, repeat: Infinity } }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_10px_20px_rgba(99,102,241,0.4)] overflow-visible">
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <motion.g animate={state === 'processing' ? { rotate: [-10, 10, -10] } : { rotate: [-5, 5, -5] }} style={{ originX: "50px", originY: "50px" }} transition={{ duration: state === 'processing' ? 0.2 : 2, repeat: Infinity }}>
          <line x1="50" y1="30" x2="50" y2="5" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />
          <motion.circle cx="50" cy="5" r="4" fill={state === 'success' || state === 'celebrating' ? "#4ade80" : "#fbbf24"} filter="url(#glow)" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
        </motion.g>
        <rect x="22" y="30" width="56" height="45" rx="14" fill="url(#bodyGrad)" stroke="#c4b5fd" strokeWidth="2" />
        <rect x="30" y="38" width="40" height="24" rx="8" fill="#1e1b4b" />
        <g fill="#22d3ee" filter="url(#glow)">
          {state === 'success' || state === 'celebrating' ? (<g stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" fill="none"><path d="M36 50 Q40 45 44 50" /><path d="M56 50 Q60 45 64 50" /></g>) : (<><ellipse cx="42" cy="50" rx="4" ry={state === 'processing' ? 2 : 5} /><ellipse cx="58" cy="50" rx="4" ry={state === 'processing' ? 2 : 5} /></>)}
        </g>
        <motion.path d="M46 58 Q50 60 54 58" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" animate={state === 'success' || state === 'celebrating' ? { d: "M44 58 Q50 63 56 58", opacity: 1 } : { d: "M46 58 Q50 60 54 58", opacity: 0.6 }} />
        <motion.circle cx="12" cy="55" r="9" fill="#6366f1" stroke="#c4b5fd" strokeWidth="1.5" animate={state === 'processing' ? { y: [5, -5, 5], x: [0, 2, 0] } : state === 'celebrating' ? { y: -15 } : { y: [3, -3, 3] }} transition={{ duration: state === 'processing' ? 0.3 : 1.5, repeat: Infinity, delay: 0.2 }} />
        <motion.circle cx="88" cy="55" r="9" fill="#6366f1" stroke="#c4b5fd" strokeWidth="1.5" animate={state === 'processing' ? { y: [-5, 5, -5], x: [0, -2, 0] } : state === 'celebrating' ? { y: -15 } : { y: [-3, 3, -3] }} transition={{ duration: state === 'processing' ? 0.3 : 1.5, repeat: Infinity, delay: 0.5 }} />
      </svg>
    </motion.div>
  );
};

const App: React.FC = () => {
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [viewIndex, setViewIndex] = useState(0); 
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [tableData, setTableData] = useState<ExtractedTableData | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const mergeExcelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: number;
    if (status === ProcessingStatus.PROCESSING) {
      setLoadingMsgIndex(0);
      interval = window.setInterval(() => setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length), 2000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleFileSelect = (files: FileList) => {
    const validFiles: File[] = [];
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
            validFiles.push(files[i]);
            urls.push(URL.createObjectURL(files[i]));
        }
    }
    if (validFiles.length === 0) { setError("Please upload valid image files."); return; }
    setFileQueue(validFiles);
    setPreviewUrls(urls);
    setViewIndex(0);
    setError(null);
    setStatus(ProcessingStatus.IDLE);
    setMascotState('idle');
  };

  const handleExcelUpload = async (file: File) => {
    try {
        setMascotState('processing');
        const data = await parseExcelFile(file);
        setTableData(data);
        setStatus(ProcessingStatus.IDLE);
        setMascotState('success');
        setTimeout(() => setMascotState('idle'), 1000);
    } catch (e) {
        setError("Could not read Excel file.");
    }
  };

  const handleMergeExcel = async (files: FileList) => {
    if (files.length < 2) {
        setError("Please select at least 2 Excel files to merge.");
        return;
    }
    setMascotState('processing');
    setError(null);
    let masterData: ExtractedTableData | null = null;
    try {
        for (let i = 0; i < files.length; i++) {
            const data = await parseExcelFile(files[i]);
            if (!masterData) masterData = data;
            else masterData = mergeTableData(masterData, data);
        }
        setTableData(masterData);
        setMascotState('success');
    } catch (e) {
        setError("Failed to merge Excel files.");
        setMascotState('idle');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files); };

  const mergeTableData = (existing: ExtractedTableData, newTable: ExtractedTableData): ExtractedTableData => {
    const allHeaders = [...new Set([...existing.headers, ...newTable.headers])];
    const expandRows = (rows: string[][], headers: string[], masterHeaders: string[]) => {
      return rows.map(row => {
        return masterHeaders.map(h => {
          const idx = headers.indexOf(h);
          return idx !== -1 ? row[idx] : "";
        });
      });
    };
    const expandedExisting = expandRows(existing.rows, existing.headers, allHeaders);
    const expandedNew = expandRows(newTable.rows, newTable.headers, allHeaders);
    return {
      headers: allHeaders,
      rows: [...expandedExisting, ...expandedNew],
      summary: existing.summary
    };
  };

  const processQueue = async () => {
    if (fileQueue.length === 0) return;
    setStatus(ProcessingStatus.PROCESSING); 
    setMascotState('processing'); 
    setError(null);
    let currentData = tableData;
    try {
      for (let i = 0; i < fileQueue.length; i++) {
        setViewIndex(i); 
        const file = fileQueue[i];
        const base64 = await fileToBase64(file);
        const newData = await extractTableFromImage(base64, file.type);
        if (!currentData) currentData = newData;
        else currentData = mergeTableData(currentData, newData);
        setTableData(currentData);
      }
      setStatus(ProcessingStatus.SUCCESS); 
      setMascotState('success');
      setFileQueue([]); 
      setPreviewUrls([]);
    } catch (err: any) {
      console.error(err); 
      setError(err.message || "Failed."); 
      setStatus(ProcessingStatus.ERROR); 
      setMascotState('idle');
    }
  };

  const nextPreview = () => setViewIndex(prev => (prev + 1) % previewUrls.length);
  const prevPreview = () => setViewIndex(prev => (prev - 1 + previewUrls.length) % previewUrls.length);

  const handleReset = () => {
    setFileQueue([]); setPreviewUrls([]); setTableData(null); setStatus(ProcessingStatus.IDLE);
    setError(null); setMascotState('idle'); 
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (mergeExcelRef.current) mergeExcelRef.current.value = '';
  };

  const handleDownload = () => {
    if (tableData) {
      setMascotState('celebrating');
      generateAndDownloadExcel(tableData, 'VisionSheet_Pro_Export');
      setTimeout(() => { setMascotState('idle'); }, 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden relative">
      
      {/* Static Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#0B1121]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0"> {[...Array(15)].map((_, i) => <Particle key={i} delay={i * 2} x={Math.random() * 100} />)} </div>
      </div>
      
      <nav className="border-b border-slate-800/60 bg-[#0B1121]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <motion.div whileHover={{ rotateZ: 15, scale: 1.1 }} className="bg-indigo-600/90 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
              <DocumentChartBarIcon className="h-5 w-5 text-white" />
            </motion.div>
            <div className="flex flex-col justify-center">
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 leading-none mb-0.5">VisionSheet</span>
              <span className="text-[10px] text-slate-500 font-medium tracking-widest uppercase select-none pointer-events-none">Chinmaygouda Patil</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-xs text-slate-400 hidden sm:flex items-center gap-2"><SparklesIcon className="w-3 h-3 text-amber-400 animate-pulse" />Powered by Gemini 2.5 Flash</motion.div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 py-6 sm:py-8 flex flex-col items-center relative z-10">
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-4xl mb-8 relative z-20">
          <div className="relative inline-block">
            {mascotState === 'idle' && <RoboMascot layoutId="mascot" state={mascotState} className="absolute -top-12 -right-4 w-16 h-16" />}
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-3 drop-shadow-2xl leading-tight">
              Turn <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Pixels</span> into <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Excel</span>
            </h1>
          </div>
          <p className="text-base text-slate-400 mt-2">Batch process multiple images with smart merging.</p>
        </motion.div>

        {/* --- MAIN CONTAINER --- */}
        <div className={`w-full relative transition-all duration-500 ease-in-out ${(!fileQueue.length && !tableData) ? 'max-w-3xl' : 'max-w-[90rem]'}`}>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-md">
            <div className="p-6">
              <AnimatePresence mode="wait" initial={false}>
              {!fileQueue.length && !tableData ? (
                // INITIAL UPLOAD SCREEN
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 gap-6">
                    <div className="relative group cursor-pointer" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                        <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-indigo-400 bg-slate-800/90' : 'border-slate-600 bg-slate-900/80 hover:bg-slate-900/90'}`}>
                            <CloudArrowUpIcon className="h-12 w-12 mx-auto mb-3 text-indigo-400" />
                            <h3 className="text-xl font-bold mb-1 text-white">Upload Images</h3>
                            <p className="text-slate-400 mb-4 text-sm">Select multiple images</p>
                            <span className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-medium shadow-lg hover:bg-indigo-500">Select Files</span>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => e.target.files && handleFileSelect(e.target.files)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div onClick={() => excelInputRef.current?.click()} className="border border-slate-700 hover:border-emerald-500/50 bg-slate-900/50 hover:bg-slate-900 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all">
                            <DocumentPlusIcon className="w-5 h-5 text-emerald-500" /><span className="font-medium text-slate-300 text-sm">Load existing Excel</span>
                            <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx" onChange={(e) => e.target.files?.[0] && handleExcelUpload(e.target.files[0])} />
                        </div>
                        <div onClick={() => mergeExcelRef.current?.click()} className="border border-slate-700 hover:border-purple-500/50 bg-slate-900/50 hover:bg-slate-900 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all">
                            <Square3Stack3DIcon className="w-5 h-5 text-purple-500" /><span className="font-medium text-slate-300 text-sm">Merge Excel Files</span>
                            <input type="file" ref={mergeExcelRef} className="hidden" accept=".xlsx" multiple onChange={(e) => e.target.files && handleMergeExcel(e.target.files)} />
                        </div>
                    </div>
                </motion.div>
              ) : (
                // WORKSPACE - 30% Left, 70% Right
                <motion.div key="workspace" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                  
                  {/* Left Column: Preview (Takes 3/10 columns) */}
                  <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
                        {fileQueue.length > 0 ? `Image ${viewIndex + 1} / ${fileQueue.length}` : 'Processing Complete'}
                      </h3>
                      {(status !== ProcessingStatus.PROCESSING && tableData) && (<button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50"><XMarkIcon className="h-3 w-3" /> Reset</button>)}
                    </div>
                    
                    {fileQueue.length > 0 ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900/50 group shadow-inner min-h-[250px] max-h-[400px] flex items-center justify-center">
                            {fileQueue.length > 1 && (
                                <>
                                <button onClick={prevPreview} className="absolute left-2 z-30 p-1 bg-black/50 rounded-full hover:bg-black/70 text-white"><ChevronLeftIcon className="w-5 h-5"/></button>
                                <button onClick={nextPreview} className="absolute right-2 z-30 p-1 bg-black/50 rounded-full hover:bg-black/70 text-white"><ChevronRightIcon className="w-5 h-5"/></button>
                                </>
                            )}
                            <img src={previewUrls[viewIndex]} alt="Preview" className={`w-full h-full object-contain transition-all duration-300 ${status === ProcessingStatus.PROCESSING ? 'opacity-50 grayscale' : ''}`} />
                            {status === ProcessingStatus.PROCESSING && <div className="absolute inset-0 z-20 bg-black/10 backdrop-blur-[1px]" />}
                        </div>
                    ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="relative border-2 border-dashed border-slate-600 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[250px] bg-slate-900/50 hover:bg-slate-800 transition-all">
                             <PhotoIcon className="w-10 h-10 text-slate-500 mb-3" />
                             <h3 className="text-base font-semibold text-slate-300">Add More Images</h3>
                             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => e.target.files && handleFileSelect(e.target.files)} />
                        </div>
                    )}

                    {(status === ProcessingStatus.IDLE && fileQueue.length > 0) && (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={processQueue} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                        <TableCellsIcon className="h-5 w-5" />{tableData ? "Merge & Add Data" : "Convert All Images"}
                      </motion.button>
                    )}

                    {status === ProcessingStatus.PROCESSING && (
                      <div className="relative w-full py-3 bg-slate-800/50 rounded-xl flex flex-col items-center justify-center gap-2 border border-slate-700/50">
                        {mascotState === 'processing' && <RoboMascot layoutId="mascot" state={mascotState} className="absolute -top-10 right-1/2 translate-x-1/2 w-14 h-14" />}
                        <div className="flex items-center gap-2"><ArrowPathIcon className="h-4 w-4 animate-spin text-cyan-400" /><span className="text-cyan-300 text-sm font-medium">{LOADING_MESSAGES[loadingMsgIndex]}</span></div>
                      </div>
                    )}
                    {error && <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">{error}</div>}
                  </div>

                  {/* Right Column: Data (Takes 7/10 columns) */}
                  <div className="lg:col-span-7 flex flex-col gap-4 h-full">
                     <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2"><div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>Extracted Data</h3>
                      {tableData && <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Rows: {tableData.rows.length}</span>}
                    </div>

                    <div className="bg-[#0f172a] border border-slate-700 rounded-xl overflow-hidden relative shadow-inner flex flex-col h-[600px]">
                      {!tableData ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-8 text-center bg-slate-900/50">
                           {status === ProcessingStatus.PROCESSING ? <p className="text-slate-400 text-sm animate-pulse">Synthesizing data...</p> : <><div className="bg-slate-800 p-4 rounded-full mb-3"><TableCellsIcon className="h-8 w-8 text-slate-500" /></div><p className="text-sm">Data preview will appear here</p></>}
                        </div>
                      ) : (
                        <div className="flex-grow overflow-y-auto custom-scrollbar">
                          <table className="w-full text-xs text-left text-slate-300">
                            <thead className="text-[10px] uppercase bg-slate-800 text-slate-400 sticky top-0 z-10 shadow-sm"><tr>{tableData.headers.map((header, idx) => <th key={idx} className="px-4 py-3 border-b border-slate-700 whitespace-nowrap font-semibold tracking-wider bg-slate-800">{header}</th>)}</tr></thead>
                            <tbody>{tableData.rows.map((row, rowIdx) => <tr key={rowIdx} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors group">{row.map((cell, cellIdx) => <td key={cellIdx} className="px-4 py-2 whitespace-nowrap group-hover:text-white">{cell}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {tableData && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 relative">
                        {(mascotState === 'success' || mascotState === 'celebrating') && <RoboMascot layoutId="mascot" state={mascotState} className="absolute -top-14 right-0 w-14 h-14 z-50" />}
                        {tableData.summary && <div className="text-xs text-slate-300 bg-slate-800/80 p-3 rounded-lg border-l-2 border-indigo-500 shadow-lg"><span className="text-indigo-400 font-bold block mb-0.5 uppercase tracking-wider">AI Summary</span>{tableData.summary}</div>}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDownload} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2">
                          <ArrowDownTrayIcon className="w-4 h-4" /> Download Professional Excel
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
      <footer className="py-4 text-center text-slate-500 text-xs border-t border-slate-800 bg-[#0B1121] relative z-10"><p>© 2025 VisionSheet. Powered by Google Gemini 2.5 Flash.</p></footer>
    </div>
  );
};

export default App;