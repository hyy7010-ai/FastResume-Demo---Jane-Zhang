
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, ResumeContent, CareerPredictionResult } from '../types';
import { generateCareerPrediction, generateCareerStrategy } from '../services/geminiService';

interface CareerPathPredictorProps {
  projects: Project[];
  resume: ResumeContent | null;
  onNavigateToResume?: (role: string) => void;
  onDownloadComplete?: (role: string) => void;
}

interface StrategyHistoryItem {
    id: string;
    role: string;
    timestamp: number;
    data: any;
}

export const CareerPathPredictor: React.FC<CareerPathPredictorProps> = ({ projects, resume, onNavigateToResume, onDownloadComplete }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CareerPredictionResult | null>(null);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [targetRole, setTargetRole] = useState('');
  const [resumeSource, setResumeSource] = useState<'current' | 'new'>('current');
  const [entryMode, setEntryMode] = useState<'idle' | 'targeted'>('idle');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  // History State
  const [strategyHistory, setStrategyHistory] = useState<StrategyHistoryItem[]>([]);

  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyData, setStrategyData] = useState<any>(null);
  const strategyContainerRef = useRef<HTMLDivElement>(null);
  const pivotFileInputRef = useRef<HTMLInputElement>(null);

  // Timeline Start Year - Hardcoded to 2026
  const startYear = "2026";

  // Load History
  useEffect(() => {
      const saved = localStorage.getItem('career_strategy_history_v1');
      if (saved) {
          try { setStrategyHistory(JSON.parse(saved)); } catch(e) {}
      }
  }, []);

  const handlePredict = async (isReAnalysis = false) => {
    if (resumeSource === 'new' && isReAnalysis && !pivotFileInputRef.current?.files?.[0]) {
        pivotFileInputRef.current?.click();
        return;
    }
    setLoading(true);
    setStrategyData(null); 
    if (isReAnalysis) setResult(null); 
    try {
      const data = await generateCareerPrediction(projects, resume, isReAnalysis ? targetRole : undefined);
      setResult(data);
    } catch (e) {
      alert("Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          handlePredict(true);
      }
  };

  const handleGenerateStrategy = async () => {
    if (!result || !result.paths[selectedPathIndex]) return;
    setStrategyLoading(true);
    setStrategyData(null);
    try {
      const path = result.paths[selectedPathIndex];
      const data = await generateCareerStrategy(resume, projects, path.role, path.missingSkills);
      setStrategyData(data);
      
      const newEntry: StrategyHistoryItem = {
          id: Date.now().toString(),
          role: path.role,
          timestamp: Date.now(),
          data: data
      };
      const updatedHistory = [newEntry, ...strategyHistory].slice(0, 10);
      setStrategyHistory(updatedHistory);
      localStorage.setItem('career_strategy_history_v1', JSON.stringify(updatedHistory));

    } catch (e) {
        alert("Strategy generation failed.");
    } finally {
      setStrategyLoading(false);
    }
  };

  const loadStrategyFromHistory = (item: StrategyHistoryItem) => {
      setStrategyData(item.data);
      if (!result) {
          setResult({
              currentLevel: "History View",
              skillTrajectory: [],
              paths: [{
                  role: item.role,
                  match: 0, salaryRange: "", timeToReach: "", description: "Loaded from history",
                  missingSkills: []
              }],
              actionPlan: []
          });
      }
      setSelectedPathIndex(0); 
  };

  useEffect(() => {
    if (strategyData && strategyContainerRef.current) {
        setTimeout(() => {
            strategyContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, [strategyData]);

  const paths = result?.paths || [];
  const currentPath = paths[selectedPathIndex];

  // FIX: Robust PDF Export with Standardized Centering using mm units
  const handleDownloadPDF = async () => {
      if (!strategyContainerRef.current || !currentPath) return;
      const html2pdf = (window as any).html2pdf;
      
      if (!html2pdf) {
          alert("PDF generator library not loaded. Please refresh.");
          return;
      }

      const safeRole = currentPath.role.replace(/[^a-z0-9]/gi, '_');
      const filename = `Strategy_${safeRole}.pdf`;

      // 1. Create a hidden Stage to render the PDF perfectly
      const stage = document.createElement('div');
      stage.style.cssText = `
        position: fixed; top: -10000px; left: -10000px; 
        width: 210mm; background: white; z-index: -1;
      `;
      document.body.appendChild(stage);

      // 2. The Capture Container (Pixel-Perfect A4 for mm-based JS-PDF)
      const captureContainer = document.createElement('div');
      captureContainer.style.cssText = `
        width: 210mm; 
        min-height: 297mm; 
        padding: 15mm; 
        box-sizing: border-box; 
        background: white;
        margin: 0;
      `;
      stage.appendChild(captureContainer);

      // 3. Clone and sanitize the report content
      const contentElement = strategyContainerRef.current.querySelector('.strategy-report-content');
      if (!contentElement) {
          document.body.removeChild(stage);
          return;
      }
      
      const clone = contentElement.cloneNode(true) as HTMLElement;

      // Reset styles to ensure full-width, centered flow inside the A4 container
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.borderRadius = '0';
      clone.style.margin = '0';
      clone.style.width = '100%';
      clone.style.maxWidth = '100%';
      clone.style.animation = 'none';
      clone.style.transform = 'none';
      clone.classList.remove('animate-slide-down', 'shadow-2xl', 'rounded-[2rem]', 'mb-32', 'border');

      // Remove UI elements that shouldn't appear in print
      const buttons = clone.querySelectorAll('button');
      buttons.forEach(b => b.remove());

      captureContainer.appendChild(clone);

      // 4. Wait for styles to settle
      await new Promise(resolve => setTimeout(resolve, 800));

      // 5. PDF Generation Parameters for Perfect Centering
      const opt = {
          margin: 0, // No PDF margin, we used internal 15mm padding in captureContainer
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
              scale: 2, 
              useCORS: true, 
              logging: false,
              scrollY: 0,
              scrollX: 0,
              width: 794 // Forces canvas to exactly A4 width at 96 DPI to match JS-PDF A4
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
      };

      try {
          await html2pdf().set(opt).from(captureContainer).save();
          if (onDownloadComplete) onDownloadComplete(currentPath.role);
      } catch (err) {
          console.error("PDF Export Error:", err);
          alert("Error generating PDF");
      } finally {
          document.body.removeChild(stage);
      }
  };

  const renderStars = (match: number) => {
      const count = Math.round(match / 20);
      return Array(5).fill(0).map((_, i) => (
          <span key={i} className={`text-[10px] ${i < count ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
      ));
  };

  const resetAll = () => {
      setResult(null);
      setStrategyData(null);
      setTargetRole('');
      setEntryMode('idle');
  };

  if (!result && !loading) {
    return (
      <div className="w-full bg-[#0b1120] text-white min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 font-['Plus_Jakarta_Sans'] overflow-hidden">
        <div className="max-w-3xl w-full text-center animate-fade-in relative">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-8 shadow-2xl">
            Career Strategy AI
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-8 text-white">
            Map Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Future.</span>
          </h1>
          <p className="text-slate-400 text-base font-medium mb-12 max-w-xl mx-auto leading-relaxed">
            Starting from your current status in {startYear}, our AI evaluates every project to build your unique professional trajectory.
          </p>

          <div className="grid md:grid-cols-2 gap-6 relative z-10">
            <button onClick={() => handlePredict(false)} className="p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all text-left group">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h3 className="text-lg font-bold mb-1 text-white">Auto Trajectory</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Based on Current Resume</p>
            </button>
            <button onClick={() => setEntryMode('targeted')} className="p-6 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all text-left group">
              <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
              <h3 className="text-lg font-bold mb-1 text-white">Targeted Pivot</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aim for a Specific Role</p>
            </button>
          </div>

          {strategyHistory.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/5">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Recent Strategies</h3>
                  <div className="flex justify-center gap-4 flex-wrap">
                      {strategyHistory.slice(0, 3).map(h => (
                          <button key={h.id} onClick={() => loadStrategyFromHistory(h)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-xs font-bold text-slate-300 transition-all">
                              {h.role}
                          </button>
                      ))}
                  </div>
              </div>
          )}

          {entryMode === 'targeted' && (
            <div className="mt-8 p-8 bg-white/5 border border-white/10 rounded-[2.5rem] animate-fade-in-up">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-grow">
                    <input type="text" placeholder="Target Role (e.g. APAC Digital Marketing Manager)" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="w-full bg-[#1e293b] border border-white/10 p-4 rounded-xl text-sm font-medium text-white outline-none focus:border-indigo-500 transition-all" />
                  </div>
                  <button onClick={() => handlePredict(true)} disabled={!targetRole.trim()} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-30">Predict</button>
                </div>
                
                <div className="flex items-center justify-center gap-10">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="source" className="hidden" checked={resumeSource === 'current'} onChange={() => setResumeSource('current')} />
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${resumeSource === 'current' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600'}`}>
                            {resumeSource === 'current' && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-scale-in"></div>}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${resumeSource === 'current' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>Current Resume</span>
                    </label>
                    <div className="relative">
                        <label className="flex items-center gap-2 cursor-pointer group" onClick={() => pivotFileInputRef.current?.click()}>
                            <input type="radio" name="source" className="hidden" checked={resumeSource === 'new'} onChange={() => setResumeSource('new')} />
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${resumeSource === 'new' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600'}`}>
                                {resumeSource === 'new' && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-scale-in"></div>}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${resumeSource === 'new' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>Upload New PDF</span>
                            </div>
                        </label>
                        <input type="file" ref={pivotFileInputRef} className="hidden" accept=".pdf,.docx,image/*" onChange={handleNewResumeUpload} />
                    </div>
                </div>
              </div>
              <button onClick={() => setEntryMode('idle')} className="mt-8 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 mx-auto border-t border-white/5 pt-4 w-full justify-center">
                 <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const skillTrajectory = result?.skillTrajectory || [];

  return (
    <div className="w-full bg-[#0b1120] text-white pt-4 pb-20 md:px-8 font-['Plus_Jakarta_Sans'] relative">
      <div className="max-w-6xl mx-auto">
        <div className="bg-[#0b1222] rounded-[3rem] p-8 mb-12 shadow-2xl border border-white/5 relative overflow-hidden flex flex-col lg:flex-row items-center gap-10">
            <div className="w-full lg:w-1/3 shrink-0 relative z-10 text-center lg:text-left">
                <button onClick={resetAll} className="mb-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors group justify-center lg:justify-start">
                    <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Start Over
                </button>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
                    Timeline (Start: {startYear})
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white leading-tight">
                    {result?.currentLevel || 'Emerging Talent'}
                </h1>
            </div>

            <div className="w-full lg:w-2/3 flex items-center relative min-h-[180px] lg:mt-0 px-6">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-800 -translate-y-1/2 overflow-visible">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-indigo-500 to-indigo-900 animate-pulse opacity-50"></div>
                </div>
                
                <div className="flex w-full justify-between items-center relative z-10 h-full">
                    {skillTrajectory.map((step, i) => {
                        const isAbove = i % 2 === 0; 
                        return (
                            <div key={i} className="flex flex-col items-center justify-center flex-grow group relative px-1 h-full">
                                <div className={`absolute w-[1px] bg-indigo-500/30 z-0 transition-all duration-500 group-hover:bg-indigo-400
                                    ${isAbove ? 'bottom-[50%] mb-0 h-[20px] group-hover:h-[40px]' : 'top-[50%] mt-0 h-[20px] group-hover:h-[40px]'}
                                `}></div>
                                <div className="w-2 h-2 rounded-full bg-indigo-500 border-2 border-[#0b1222] shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-150 transition-all duration-300 z-20 relative"></div>
                                <div className={`absolute left-1/2 -translate-x-1/2 w-[140px] z-30 flex flex-col items-center transition-all duration-500
                                    ${isAbove ? 'bottom-[50%] mb-6 group-hover:mb-10' : 'top-[50%] mt-6 group-hover:mt-10'}
                                `}>
                                    <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-2xl group-hover:border-indigo-500/30 transition-colors text-center w-full">
                                        <div className="text-[8px] font-bold text-indigo-400/80 uppercase tracking-widest mb-1">{step.year}</div>
                                        <p className="text-[9px] font-bold text-slate-200 leading-tight break-words group-hover:text-white transition-colors">
                                            {step.skill}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    <div className="flex flex-col items-center justify-center flex-grow group relative px-1 h-full min-w-[100px]">
                        <div className="absolute bottom-[50%] h-[20px] mb-0 w-[1px] bg-purple-500/30 z-0"></div>
                        <div className="absolute w-8 h-8 bg-purple-500/10 rounded-full blur-md animate-pulse"></div>
                        <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-[#0b1222] shadow-[0_0_15px_rgba(168,85,247,0.8)] z-20 relative"></div>
                        <div className="absolute left-1/2 -translate-x-1/2 w-[140px] bottom-[50%] mb-6 z-30">
                            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)] text-center">
                                <div className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">TARGET GOAL</div>
                                <p className="text-[10px] font-bold text-white leading-tight">
                                    {currentPath?.role || 'Future Role'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full"></div>
            </div>
        </div>

        <div className="relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-[#0b1120]/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center rounded-[3rem]">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
              <p className="text-white font-bold uppercase tracking-[0.2em] text-[10px] animate-pulse">
                Analyzing Career Data
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {paths.map((path, idx) => (
              <div key={idx} onClick={() => { setSelectedPathIndex(idx); setStrategyData(null); }} className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer relative overflow-hidden flex flex-col group ${selectedPathIndex === idx ? 'bg-white text-slate-900 border-white shadow-xl scale-[1.02] z-10' : 'bg-white/5 text-white border-white/5 hover:bg-white/10 hover:border-white/10'}`}>
                <div className="mb-6 flex justify-between items-start">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${selectedPathIndex === idx ? 'text-slate-400' : 'text-white/30'}`}>OPTION 0{idx + 1}</span>
                  {idx === 0 && <span className="px-3 py-1 bg-emerald-500 text-white text-[8px] font-bold rounded-full uppercase tracking-wide">Best Fit</span>}
                </div>
                <h3 className="text-xl font-bold mb-4 leading-tight tracking-tight">{path.role}</h3>
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="flex gap-0.5">{renderStars(path.match)}</div>
                  <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${selectedPathIndex === idx ? 'text-indigo-600' : 'text-indigo-400'}`}>{path.match}% Match</span>
                </div>
                <p className={`text-[13px] leading-relaxed mb-8 flex-grow ${selectedPathIndex === idx ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>{path.description}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedPathIndex(idx); handleGenerateStrategy(); }} 
                  disabled={strategyLoading}
                  className={`w-full py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 ${selectedPathIndex === idx ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white/5 text-white hover:bg-white/10'}`}
                >
                  {strategyLoading && selectedPathIndex === idx ? 'Generating...' : 'View Strategy'}
                </button>
              </div>
            ))}
          </div>

          <div ref={strategyContainerRef} className="scroll-mt-24 transition-all duration-700">
            {strategyData && !strategyLoading && (
                <div className="strategy-report-content w-full bg-white text-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden mb-32 animate-slide-down">
                    <div className="strategy-header bg-white p-12 border-b border-slate-100 flex flex-col items-center text-center">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Confidential Report</span>
                        <h3 className="text-4xl font-black tracking-tight leading-tight text-slate-900 mb-2">Strategy: {currentPath?.role}</h3>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-8">
                            Generated by AI Fast Resume
                        </p>
                        <div className="flex gap-4 items-center shrink-0" data-html2canvas-ignore="true">
                            <button onClick={handleDownloadPDF} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
                                Download PDF
                            </button>
                            <button onClick={() => setStrategyData(null)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors text-lg">×</button>
                        </div>
                    </div>

                    <div className="p-12 bg-white relative">
                        <div className="grid gap-16">
                            <div className="break-inside-avoid">
                                <h4 className="text-xl font-black text-indigo-600 mb-6 flex items-center gap-3">
                                   <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-md">1</span>
                                   Skill Gap Analysis
                                </h4>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {strategyData.gapFix?.map((item: any, i: number) => (
                                        <div key={i} className="p-6 bg-slate-50 border border-slate-100 rounded-xl">
                                            <h5 className="font-bold text-sm text-slate-900 mb-2">{item.topic}</h5>
                                            <p className="text-xs text-slate-600 mb-3 leading-relaxed">{item.advice}</p>
                                            <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">
                                                Resource: {item.resource}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="break-inside-avoid">
                                <h4 className="text-xl font-black text-indigo-600 mb-6 flex items-center gap-3">
                                   <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-md">2</span>
                                   Interview Prep
                                </h4>
                                <div className="space-y-4">
                                    {strategyData.interviewPrep?.map((item: any, i: number) => (
                                        <div key={i} className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <p className="font-bold text-slate-900 text-sm mb-3 italic">"{item.question}"</p>
                                            <div className="pl-4 border-l-2 border-indigo-200">
                                                <p className="text-xs text-slate-600 leading-relaxed">{item.suggestedAnswer}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="break-inside-avoid">
                                <h4 className="text-xl font-black text-indigo-600 mb-6 flex items-center gap-3">
                                   <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-md">3</span>
                                   Portfolio Projects
                                </h4>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {strategyData.portfolioUpgrade?.map((item: any, i: number) => (
                                        <div key={i} className="group border border-slate-100 p-6 rounded-xl hover:border-indigo-100 transition-colors">
                                            <h5 className="font-bold text-sm text-slate-900 mb-2">{item.title}</h5>
                                            <p className="text-xs text-slate-500 leading-relaxed">{item.strategy}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-8 text-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] border-t border-slate-100">
                        CONFIDENTIAL CAREER STRATEGY
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      <div className={`fixed top-24 right-0 h-[calc(100vh-140px)] z-[100] transition-all duration-700 flex ${showHistoryPanel ? 'translate-x-0' : 'translate-x-[calc(100%-56px)]'}`}>
            <button onClick={() => setShowHistoryPanel(!showHistoryPanel)} className="w-14 bg-[#0b1222]/90 backdrop-blur-xl h-56 my-auto rounded-l-[1.5rem] flex flex-col items-center justify-center gap-4 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] border border-white/10 text-slate-400 hover:text-indigo-400 transition-all group hover:w-16">
                <div style={{ writingMode: 'vertical-rl' }} className="rotate-180 text-[10px] font-black tracking-[0.3em] uppercase">STRATEGIES</div>
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-white group-hover:bg-indigo-600 transition-colors">{strategyHistory.length}</div>
            </button>
            <div className="w-80 h-full bg-[#0b1222] border-l border-white/10 shadow-[-40px_0_100px_rgba(0,0,0,0.15)] flex flex-col">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Saved Plans</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Career Roadmaps</p>
                    </div>
                    <button onClick={() => { if(confirm("Clear history?")) { setStrategyHistory([]); localStorage.removeItem('career_strategy_history_v1'); } }} className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] hover:text-rose-400">Clear</button>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {strategyHistory.map(h => (
                        <div key={h.id} onClick={() => loadStrategyFromHistory(h)} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/50 cursor-pointer transition-all hover:bg-white/10 group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{h.role}</h4>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(h.timestamp).toLocaleDateString()}</div>
                        </div>
                    ))}
                    {strategyHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-center opacity-30">
                            <div className="text-2xl mb-2 text-slate-500">📜</div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Saved Strategies</p>
                        </div>
                    )}
                </div>
            </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-slide-down { animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1; transform: translateY(0); } }
        .section-block { page-break-inside: avoid; break-inside: avoid; }
      `}} />
    </div>
  );
};
