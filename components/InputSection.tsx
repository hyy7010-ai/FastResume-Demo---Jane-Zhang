
import React, { useRef, useState, useEffect } from 'react';
import mammoth from "https://esm.sh/mammoth@1.6.0";
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface InputSectionProps {
  jdText: string;
  setJdText: (text: string) => void;
  onGenerate: (fileInput?: { mimeType: string; data: string } | string) => void;
  onGenerateProject: (fileInput: { mimeType: string; data: string; fileName: string }) => void;
  isLoading: boolean;
  lang: Language;
}

const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 1000;

      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/webp', 0.8);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = (e) => reject(e);
  });
};

export const InputSection: React.FC<InputSectionProps> = ({ jdText, setJdText, onGenerate, onGenerateProject, isLoading, lang }) => {
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [resumeFileData, setResumeFileData] = useState<{ mimeType: string; data: string } | null>(null);
  const [extractedResumeText, setExtractedResumeText] = useState<string | null>(null);
  const [projectFileName, setProjectFileName] = useState<string | null>(null);
  const [projectFileData, setProjectFileData] = useState<{ mimeType: string; data: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [isDraggingProject, setIsDraggingProject] = useState(false);

  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Initializing AI...");
  
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const savedResume = localStorage.getItem('fastresume_last_file');
    if (savedResume) {
      try {
        const parsed = JSON.parse(savedResume);
        setResumeFileName(parsed.name);
        setResumeFileData(parsed.data);
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setProgress(0);
      const texts = ["Reading resume structure...", "Analyzing core skills...", "Scanning for RMIT background...", "Matching JD keywords..."];
      let textIdx = 0;
      setLoadingText(texts[0]);
      
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev; 
          const increment = Math.random() * 3 + 2; 
          if (prev > 25 && textIdx === 0) { textIdx=1; setLoadingText(texts[1]); }
          if (prev > 50 && textIdx === 1) { textIdx=2; setLoadingText(texts[2]); }
          if (prev > 75 && textIdx === 2) { textIdx=3; setLoadingText(texts[3]); }
          return Math.min(prev + increment, 98);
        });
      }, 100); 
    } else {
      setProgress(0);
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isLoading]);

  const processResumeFile = async (file: File) => {
    setIsProcessing(true);
    setLoadingText("Parsing document...");
    setResumeFileName(file.name);
    setProjectFileName(null); 
    setProjectFileData(null);

    try {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = { mimeType: 'application/pdf', data: (ev.target?.result as string).split(',')[1] };
            setResumeFileData(data);
            localStorage.setItem('fastresume_last_file', JSON.stringify({ name: file.name, data }));
            setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.docx')) {
         const arrayBuffer = await file.arrayBuffer();
         const result = await mammoth.extractRawText({ arrayBuffer });
         setExtractedResumeText(result.value);
         setResumeFileData(null); 
         setIsProcessing(false);
      } else {
        alert("Unsupported resume file type. Please upload PDF or DOCX.");
        setResumeFileName(null);
        setResumeFileData(null);
        setExtractedResumeText(null);
        setIsProcessing(false);
      }
    } catch (error) {
        console.error("File processing error", error);
        setIsProcessing(false);
    }
  };

  const processProjectFile = async (file: File) => {
    setIsProcessing(true);
    setLoadingText("Processing media...");
    setResumeFileName(null);
    setResumeFileData(null);
    setExtractedResumeText(null);
    setProjectFileName(file.name);

    try {
        if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            setProjectFileData({ mimeType: 'text/plain', data: result.value }); 
        } else if (file.type.startsWith('image/')) {
            const compressedBase64 = await compressImage(file);
            setProjectFileData({ mimeType: 'image/webp', data: compressedBase64 });
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const base64Data = (ev.target?.result as string).split(',')[1];
              const mimeType = file.type || 'application/pdf'; 
              setProjectFileData({ mimeType, data: base64Data });
            };
            // Fix typo: readAsAsDataURL -> readAsDataURL
            reader.readAsDataURL(file);
        }
    } catch (e) {
        console.error(e);
        alert("Error processing file.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, type: 'resume' | 'project') => {
    e.preventDefault();
    if (type === 'resume') setIsDraggingResume(true);
    else setIsDraggingProject(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'resume' | 'project') => {
    e.preventDefault();
    if (type === 'resume') setIsDraggingResume(false);
    else setIsDraggingProject(false);
  };

  const handleDrop = (e: React.DragEvent, type: 'resume' | 'project') => {
    e.preventDefault();
    if (type === 'resume') {
      setIsDraggingResume(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processResumeFile(file);
    } else {
      setIsDraggingProject(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processProjectFile(file);
    }
  };

  const currentResumeInput = resumeFileData || extractedResumeText;
  const currentFileInputName = resumeFileName || projectFileName;

  const steps = [
    { num: 1, label: t.step1, active: !!jdText },
    { num: 2, label: t.step2, active: !!(currentFileInputName) },
    { num: 3, label: t.step3, active: isLoading }
  ];

  const handleOptimizeClick = () => {
    if (projectFileData) {
      onGenerateProject({ mimeType: projectFileData.mimeType, data: projectFileData.data, fileName: projectFileName! });
    } else if (currentResumeInput) {
      onGenerate(currentResumeInput);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 relative">
      <div className="text-center mb-16 pt-10">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-10 text-slate-900">
          {t.heroTitle} <br />
          <span className="text-indigo-600">{t.heroTitleHighlight}</span>
        </h1>
        <p className="text-slate-400 text-xl font-bold max-w-2xl mx-auto leading-relaxed">
          {t.heroSubtitle}
        </p>
        
        <div className="flex justify-center items-center gap-4 mt-20">
            {steps.map((step, i) => (
                <React.Fragment key={step.num}>
                    <div className="flex flex-col items-center gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black transition-all duration-500 border-4 ${
                            step.active
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200 scale-110' 
                            : 'border-slate-200 text-slate-300 bg-white'
                        }`}>
                            {step.num}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${step.active ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {step.label}
                        </span>
                    </div>
                    {i < 2 && (
                        <div className="w-24 h-1 bg-slate-100 rounded-full mx-2 -mt-8 relative overflow-hidden">
                           <div className={`absolute inset-0 bg-indigo-600 transition-transform duration-700 origin-left ${steps[i].active && steps[i+1].active ? 'scale-x-100' : 'scale-x-0'}`}></div>
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden relative">
        {isLoading && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-12">
                <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-8"></div>
                <div className="text-center w-full max-w-md">
                   <p className="text-3xl font-black tracking-tight mb-2 text-slate-900">{t.analyzing}</p>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] mb-6">Estimated: 15-20s</p>
                   <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                      <div className="h-full bg-indigo-600 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)]" style={{ width: `${progress}%` }}></div>
                   </div>
                   <div className="flex justify-between mt-3 px-1">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{loadingText}</span>
                      <span className="text-[10px] font-black text-slate-400">{Math.round(progress)}%</span>
                   </div>
                </div>
            </div>
        )}
        
        <div className="grid md:grid-cols-2">
           <div className="p-12 lg:p-16 border-r border-slate-100">
              <div className="flex justify-between items-end mb-8">
                <div>
                   <h2 className="text-4xl font-black tracking-tight text-slate-900">{t.jdLabel}</h2>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] mt-2">PASTE YOUR TARGET ROLE REQUIREMENTS</p>
                </div>
                <button onClick={() => setJdText('')} className="text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest pb-1">{t.clear}</button>
              </div>
              <div className="h-[350px]">
                 <textarea
                  className="w-full h-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-indigo-600 focus:bg-white outline-none resize-none text-slate-700 transition-all font-bold text-sm leading-relaxed"
                  placeholder={t.jdPlaceholder}
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
              </div>
           </div>

           <div className="p-12 lg:p-16 bg-slate-50/40">
              <div className="mb-10">
                <h2 className="text-4xl font-black tracking-tight text-slate-900">{t.yourResume}</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] mt-2">SOURCE FILE</p>
              </div>
              <input type="file" ref={resumeFileInputRef} className="hidden" accept=".pdf,.docx" onChange={(e) => processResumeFile(e.target.files?.[0] as File)} />
              <input type="file" ref={projectFileInputRef} className="hidden" accept="*" onChange={(e) => processProjectFile(e.target.files?.[0] as File)} />
              
              <div className="space-y-4">
                  {/* Integrated Resume Upload Area */}
                  <div 
                    onDragOver={(e) => handleDragOver(e, 'resume')}
                    onDragLeave={(e) => handleDragLeave(e, 'resume')}
                    onDrop={(e) => handleDrop(e, 'resume')}
                    className={`space-y-4 rounded-[2.5rem] transition-all duration-300 ${isDraggingResume ? 'bg-indigo-50 p-4 ring-4 ring-indigo-200 shadow-2xl' : ''}`}
                  >
                      {/* Standard Resume Upload */}
                      <button onClick={() => resumeFileInputRef.current?.click()} className={`w-full bg-white p-8 rounded-[2rem] border-2 transition-all flex items-center gap-6 ${resumeFileName ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-xl' : 'border-slate-100 hover:border-indigo-200 shadow-sm'}`}>
                          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex flex-col items-center justify-center font-black shrink-0">
                             <span className="text-[8px] mb-0.5">RESUME</span>
                             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="text-left">
                            <span className="block text-lg font-black">{t.uploadResume}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drag file or click to upload (.DOCX, .PDF)</span>
                          </div>
                      </button>
                  </div>

                  {/* Project Upload Area with Drag and Drop */}
                  <div 
                    onDragOver={(e) => handleDragOver(e, 'project')}
                    onDragLeave={(e) => handleDragLeave(e, 'project')}
                    onDrop={(e) => handleDrop(e, 'project')}
                    className={`rounded-[2.5rem] transition-all duration-300 ${isDraggingProject ? 'bg-emerald-50 p-4 ring-4 ring-emerald-200 shadow-2xl' : ''}`}
                  >
                      <button onClick={() => projectFileInputRef.current?.click()} className={`w-full bg-white p-8 rounded-[2rem] border-2 transition-all flex items-center gap-6 ${projectFileName ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-xl' : 'border-slate-100 hover:border-indigo-200 shadow-sm'}`}>
                          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex flex-col items-center justify-center font-black shrink-0">
                             <span className="text-[8px] mb-0.5">PROJECT</span>
                             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                          <div className="text-left">
                            <span className="block text-lg font-black">{t.uploadProject}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drag files or click to upload (Any Media)</span>
                          </div>
                      </button>
                  </div>
                  
                  {(currentFileInputName || isProcessing) && (
                      <div className="px-6 py-3 bg-indigo-600 text-white rounded-2xl flex items-center justify-between font-bold animate-fade-in shadow-lg">
                          <div className="flex items-center gap-3">
                              {isProcessing ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                              )}
                              <span className="truncate">{isProcessing ? loadingText : currentFileInputName}</span>
                          </div>
                      </div>
                  )}
              </div>

              <div className="mt-auto pt-12">
                <button
                  onClick={handleOptimizeClick}
                  disabled={!jdText || isLoading || isProcessing || (!currentResumeInput && !projectFileData)}
                  className={`w-full py-7 rounded-[2rem] font-black text-2xl transition-all ${
                    (!jdText || isLoading || isProcessing || (!currentResumeInput && !projectFileData))
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-100 hover:-translate-y-1 active:scale-95'
                  }`}
                >
                  {projectFileData ? t.analyzeProject : t.optimizeResume}
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
