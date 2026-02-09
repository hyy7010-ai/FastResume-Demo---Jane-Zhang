

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { InputSection } from './components/InputSection';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { ResumePreview } from './components/ResumePreview';
import { ProjectDisplay } from './components/ProjectDisplay'; 
import { AIChatbot } from './components/AIChatbot';
import { PortfolioGenerator } from './components/PortfolioGenerator'; 
import { MockInterview } from './components/MockInterview'; 
import { CareerPathPredictor } from './components/CareerPathPredictor'; 
import { AnalysisResult, ResumeContent, Language, PortfolioData, Project } from './types';
import { analyzeResume, analyzeProjectMedia, generatePortfolioBio, FileInput } from './services/geminiService';
import { TRANSLATIONS, DEMO_DATA } from './constants';

declare global {
  interface Window {
    exportToHtml: (element: HTMLElement) => void;
  }
}

// Hackathon Demo Modal Component (Floating Draggable Window)
const HackathonDemoModal = ({ onRunSimulation, onClose }: { onRunSimulation: () => void, onClose: () => void }) => {
  // Center initially
  const [position, setPosition] = useState({ 
      x: typeof window !== 'undefined' ? (window.innerWidth / 2) - 190 : 100, 
      y: typeof window !== 'undefined' ? (window.innerHeight / 2) - 300 : 100 
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the header
    if (dragRef.current && dragRef.current.contains(e.target as Node)) {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
        e.preventDefault(); // Prevent text selection
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // More flexible bounds
      setPosition({
        x: newX,
        y: newY
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (isMinimized) {
      return (
          <div 
            className="fixed z-[2000] cursor-pointer group transition-all duration-300 animate-fade-in shadow-2xl rounded-full"
            style={{ left: Math.max(20, Math.min(window.innerWidth - 80, position.x)), top: Math.max(20, Math.min(window.innerHeight - 80, position.y)) }}
          >
               <div 
                  className="bg-[#2e2b5f] text-white p-2 pr-4 rounded-full flex items-center gap-3 border-2 border-white/20 hover:scale-105 transition-transform hover:bg-[#3d397a] backdrop-blur-xl shadow-lg ring-1 ring-white/10 select-none cursor-move"
                  onMouseDown={handleMouseDown}
                  ref={dragRef}
               >
                  <div className="w-10 h-10 rounded-full bg-[#5552ff] flex items-center justify-center text-lg shadow-inner shrink-0 animate-pulse">🚀</div>
                  <div className="mr-2" onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}>
                      <span className="block font-black text-[10px] uppercase tracking-widest text-indigo-200">Demo</span>
                      <span className="block font-bold text-xs text-white">Expand</span>
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div 
        className="fixed z-[2000] w-[380px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] rounded-[2rem] overflow-hidden animate-fade-in border border-white/20 backdrop-blur-xl bg-white/95 transition-shadow duration-300"
        style={{ left: position.x, top: position.y, boxShadow: isDragging ? '0 60px 120px -20px rgba(0,0,0,0.6)' : undefined }}
    >
        {/* Header - Draggable */}
        <div 
            ref={dragRef}
            className={`bg-[#2e2b5f] p-6 text-center relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
        >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#5552ff] via-purple-500 to-pink-500"></div>
            
            <div className="absolute top-4 right-4 flex gap-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} 
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-md"
                    title="Minimize"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onClose(); }} 
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500/80 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-md"
                    title="Close"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="inline-flex items-center gap-2 bg-[#5552ff] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 shadow-lg ring-1 ring-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                Hackathon Demo
            </div>
            <h2 className="text-white text-xl font-black tracking-tight uppercase drop-shadow-md">Case Study: Jane Zhang</h2>
        </div>

        {/* Content */}
        <div className="p-6 bg-slate-50/50">
            <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mb-5">Drag Assets Into The App</p>
            
            <div className="space-y-2.5 mb-6">
                {[
                    { title: "Jane Zhang – Resume(2)", sub: "CANDIDATE PROFILE", icon: "📄", color: "blue" },
                    { title: "Job Description", sub: "TARGET ROLE", icon: "💼", color: "amber" },
                    { title: "Design picture for portfolio", sub: "SNAPTREK CAMPAIGN", icon: "🖼️", color: "emerald" },
                    { title: "File for portfolio page", sub: "BLOCKCHAIN REPORT", icon: "📊", color: "indigo" }
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-indigo-200 group hover:-translate-y-0.5 select-none">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-${item.color}-50 text-${item.color}-500 shrink-0`}>
                            {item.icon}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-xs leading-tight group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            <button 
                onClick={onRunSimulation}
                className="w-full py-4 bg-white border-2 border-slate-200 rounded-[1.2rem] text-slate-500 font-black text-[10px] uppercase tracking-[0.25em] hover:bg-[#5552ff] hover:text-white hover:border-[#5552ff] hover:shadow-xl transition-all active:scale-[0.98] group"
            >
                <span className="group-hover:hidden">click here see the demo</span>
                <span className="hidden group-hover:inline-block">Run Simulation 🚀</span>
            </button>
        </div>
    </div>
  );
};

function App() {
  const [jdText, setJdText] = useState(''); 
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = loadingCount > 0;
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [resumeContent, setResumeContent] = useState<ResumeContent | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  
  const [activeModule, setActiveModule] = useState<'resume' | 'portfolio' | 'interview' | 'career'>('resume');

  const [lastResumeInput, setLastResumeInput] = useState<{ mimeType: string; data: string } | string | undefined>();

  // For AI Coach Triggering
  const [coachTrigger, setCoachTrigger] = useState<{ role: string; timestamp: number } | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(true); // Default to show demo modal

  const [portfolioData, setPortfolioData] = useState<PortfolioData>({
    userProfile: { country: 'AU', role: 'Student', photo: null, bio: '' },
    theme: { color: 'indigo', template: 'Minimalist' }, 
    projects: [],
    healthScore: 0,
    jobPackage: { resume: null, coverLetter: null },
  });

  // Calculate Health Score
  useEffect(() => {
    const calculateHealthScore = () => {
      let score = 0;
      if (portfolioData.projects.length > 0) {
        score += Math.min(portfolioData.projects.length * 10, 50); 
        const starProjects = portfolioData.projects.filter(p => p.description && p.description.toLowerCase().includes('situation') && p.description.toLowerCase().includes('result'));
        score += Math.min(starProjects.length * 10, 50); 
      }
      setPortfolioData(prev => ({ ...prev, healthScore: Math.min(score, 100) }));
    };
    calculateHealthScore();
  }, [portfolioData.projects]);

  // AUTO-GENERATE BIO LISTENER
  useEffect(() => {
      if (portfolioData.projects.length === 0) return;

      const timer = setTimeout(async () => {
          try {
             const bioResult = await generatePortfolioBio(portfolioData.projects, portfolioData.jobPackage.resume);
             setPortfolioData(prev => ({
                 ...prev,
                 userProfile: { 
                     ...prev.userProfile, 
                     bio: bioResult.bio, 
                     role: bioResult.role 
                 }
             }));
          } catch (e) {
              console.error("Bio auto-gen failed", e);
          }
      }, 2000); 

      return () => clearTimeout(timer);
  }, [portfolioData.projects, portfolioData.jobPackage.resume]);


  const handleReset = () => {
    setLoadingCount(0); 
    setJdText('');
    setAnalysisResult(null);
    setResumeContent(null);
    setCoverLetter('');
    setShowEditor(false);
    setLastResumeInput(undefined);
    setPortfolioData(prev => ({ 
      ...prev,
      projects: [],
      jobPackage: { resume: null, coverLetter: null }
    }));
    // Re-open demo modal on reset for easy demo loop
    setShowDemoModal(true);
  };

  const handleCancelLoading = () => {
      setLoadingCount(0);
  };

  const handleGenerate = async (resumeInput?: string | FileInput) => {
    const input = resumeInput || lastResumeInput;
    if (!input && !resumeInput) return;

    setLoadingCount(prev => prev + 1);
    setShowEditor(false); 
    setLastResumeInput(input);

    try {
      const result = await analyzeResume(jdText, input);
      setAnalysisResult(result);
      setCoverLetter(result.coverLetter || '');
      setResumeContent(null); 
      if (result.detectedLanguage) setLang(result.detectedLanguage);
      
      setPortfolioData(prev => ({ 
        ...prev,
        jobPackage: { resume: result.optimizedResume, coverLetter: result.coverLetter }
      }));
      
      setTimeout(() => {
        document.getElementById('analysis-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (error) {
      alert("Analysis failed. Check your API key.");
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  };

  const handleGenerateProject = async (fileInput: { mimeType: string; data: string; fileName: string }) => {
    setLoadingCount(prev => prev + 1);
    try {
      // 1. Analyze the project (Images, Docs, Video, Audio)
      const newProjectData = await analyzeProjectMedia(fileInput.data, fileInput.mimeType, fileInput.fileName);
      
      const newProject: Project = {
        id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalFileName: fileInput.fileName,
        originalMimeType: fileInput.mimeType,
        base64Data: fileInput.data,
        ...newProjectData,
      };

      // 2. Update Projects State correctly (Functional Update)
      setPortfolioData(prev => ({ 
          ...prev, 
          projects: [...prev.projects, newProject] 
      }));

    } catch (error) {
      alert(`Project analysis failed for ${fileInput.fileName}`);
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  };

  // Demo Simulation Logic
  const runDemoSimulation = async () => {
      setShowDemoModal(false);
      setLoadingCount(prev => prev + 1);
      
      // 1. Set JD
      setJdText(DEMO_DATA.jdText);
      
      // 2. Set Resume (Simulate Upload)
      const resumeInput = DEMO_DATA.resumeText;
      setLastResumeInput(resumeInput);

      try {
          // 3. Analyze Resume
          const result = await analyzeResume(DEMO_DATA.jdText, resumeInput);
          setAnalysisResult(result);
          setCoverLetter(result.coverLetter || '');
          setResumeContent(null);
          
          // 4. Set Initial Portfolio Data
          setPortfolioData(prev => ({
              ...prev,
              jobPackage: { resume: result.optimizedResume, coverLetter: result.coverLetter }
          }));

          // 5. Inject Demo Projects (Simulate sequential upload for effect)
          // Project 1: Design
          const designProj: Project = {
              id: 'demo-proj-1',
              originalFileName: 'SnapTrek Campaign.png',
              originalMimeType: 'image/png',
              base64Data: DEMO_DATA.designImageBase64,
              title: 'SnapTrek Visual Campaign',
              category: 'Visual Design',
              type: 'Photo',
              description: 'Designed comprehensive visual assets for the SnapTrek outdoor campaign, focusing on vibrant colors and adventure themes to engage the target demographic on social media.',
              associatedSkills: ['Graphic Design', 'Branding', 'Adobe Creative Suite']
          };

          // Project 2: Report
          const reportProj: Project = {
              id: 'demo-proj-2',
              originalFileName: 'Blockchain Logistics Report.pdf',
              originalMimeType: 'application/pdf',
              base64Data: DEMO_DATA.reportPdfBase64,
              title: 'Enhancing Logistics with Blockchain',
              category: 'Marketing Strategy',
              type: 'Document',
              description: 'A research paper exploring the integration of blockchain technology in logistics management to improve transparency, security, and efficiency in supply chains.',
              associatedSkills: ['Research', 'Supply Chain', 'Technical Writing']
          };

          setPortfolioData(prev => ({
              ...prev,
              projects: [designProj, reportProj]
          }));

          // Scroll to result
          setTimeout(() => {
            document.getElementById('analysis-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 500);

      } catch (error) {
          console.error("Demo failed", error);
          alert("Demo simulation encountered an error.");
      } finally {
          setLoadingCount(prev => prev - 1);
      }
  };


  const handleReOptimize = useCallback(async (newJd: string) => {
    setJdText(newJd);
    setLoadingCount(prev => prev + 1);
    setShowEditor(false);
    
    try {
      const result = await analyzeResume(newJd, lastResumeInput);
      setAnalysisResult(result);
      setCoverLetter(result.coverLetter || '');
      setResumeContent(null); 
      
      setPortfolioData(prev => ({ 
        ...prev,
        jobPackage: { resume: result.optimizedResume, coverLetter: result.coverLetter }
      }));

      setTimeout(() => {
        document.getElementById('analysis-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (error) {
      alert("Re-optimization failed.");
    } finally {
      setLoadingCount(prev => prev - 1);
    }
  }, [lastResumeInput]);

  const handleConfirmExperiences = (selectedIds: string[], selectedVolunteerIds: string[], selectedProjectIds: string[]) => {
      if (!analysisResult) return;
      
      const newResumeContent = {
          ...analysisResult.optimizedResume,
          experiences: analysisResult.optimizedResume.experiences.filter(exp => selectedIds.includes(exp.id)),
          volunteer: (analysisResult.optimizedResume.volunteer || []).filter(vol => selectedVolunteerIds.includes(vol.id)),
          schoolProjects: (analysisResult.optimizedResume.schoolProjects || []).filter(p => selectedProjectIds.includes(p.id))
      };
      setResumeContent(newResumeContent);
      
      setPortfolioData(prev => ({ 
        ...prev,
        jobPackage: { resume: newResumeContent, coverLetter: prev.jobPackage.coverLetter }
      }));

      setShowEditor(true);
      
      setTimeout(() => {
          const editor = document.getElementById('resume-editor');
          if (editor) {
              editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
      }, 250);
  };

  const handleNavigateToResume = (targetRole: string) => {
    setActiveModule('resume');
    setJdText(`Target Role: ${targetRole}\n\n(Auto-generated context for ${targetRole} optimization. Please review requirements.)`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadComplete = (role: string) => {
      setCoachTrigger({ role, timestamp: Date.now() });
  };

  const t = TRANSLATIONS[lang];

  return (
    <div className="min-h-screen bg-white text-[#0f172a] selection:bg-indigo-100 flex flex-col relative">
      
      <header className="fixed top-0 w-full z-50 glass-header border-b border-slate-100 h-20 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-6 md:px-12 relative">
          <div className="flex items-center gap-3.5 cursor-pointer group shrink-0" onClick={handleReset}>
             <div className="relative">
               <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200/50 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <svg className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
               </div>
               <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-slate-50">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
               </div>
             </div>
             <div className="flex flex-col -space-y-1">
               <div className="flex items-center text-2xl font-black tracking-tighter whitespace-nowrap">
                 <span className="italic text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">Fast</span>
                 <span className="text-indigo-600 ml-1">Resume</span>
               </div>
               <div className="flex items-center gap-1.5 opacity-60">
                 <div className="h-[2px] w-4 bg-indigo-500 rounded-full"></div>
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em]">ATS Optimized</span>
               </div>
             </div>
          </div>

          <div className="hidden md:flex bg-slate-100 p-1 rounded-full border border-slate-200 absolute left-1/2 -translate-x-1/2">
             <button 
                onClick={() => setActiveModule('resume')}
                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'resume' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Resume Builder
             </button>
             <button 
                onClick={() => setActiveModule('portfolio')}
                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'portfolio' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Portfolio AI
             </button>
             <button 
                onClick={() => setActiveModule('interview')}
                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeModule === 'interview' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Interview
                <span className="bg-rose-500 text-white text-[8px] px-1.5 rounded-full">New</span>
             </button>
             <button 
                onClick={() => setActiveModule('career')}
                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeModule === 'career' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                <span>Career Path</span>
                <span className="bg-indigo-600 text-white text-[7px] px-1 rounded-sm">AI</span>
             </button>
          </div>
          
          <div className="flex items-center gap-4"></div>
        </div>
      </header>

      <main className="flex-grow pt-20">
        
        {activeModule === 'resume' && (
          <div className="animate-fade-in pt-12 pb-20">
             <InputSection 
                jdText={jdText} 
                setJdText={setJdText} 
                onGenerate={handleGenerate} 
                onGenerateProject={handleGenerateProject}
                isLoading={loading}
                lang={lang}
              />

              {portfolioData.projects.length > 0 && (
                <div id="portfolio-showcase" className="mt-24">
                  <ProjectDisplay projects={portfolioData.projects} />
                </div>
              )}

              {analysisResult && (
                <div id="analysis-section" className="mt-24">
                   <div className="py-24 bg-slate-50 border-y border-slate-100 shadow-inner relative z-10">
                     <div className="max-w-5xl mx-auto px-6 mb-16 text-center">
                        <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black tracking-[0.25em] mb-6">AI CORE ANALYSIS</span>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4">{t.matchScore}</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t.basedOn}</p>
                     </div>
                     <AnalysisDashboard data={analysisResult} onConfirmExperiences={handleConfirmExperiences} />
                   </div>
                   
                   {showEditor && resumeContent && (
                       <div id="resume-editor" className="relative z-0 scroll-mt-24 min-h-[500px]">
                          <ResumePreview 
                            content={resumeContent}
                            allOriginalExperiences={analysisResult.optimizedResume.experiences}
                            allOriginalVolunteer={analysisResult.optimizedResume.volunteer}
                            coverLetter={coverLetter}
                            missingKeywords={analysisResult.missingSkills} 
                            jdText={jdText} 
                            onUpdate={setResumeContent}
                            onUpdateCoverLetter={setCoverLetter}
                            onReOptimize={handleReOptimize}
                            lang={lang}
                            portfolioData={portfolioData}
                            setPortfolioData={setPortfolioData}
                          />
                       </div>
                   )}
                </div>
              )}
          </div>
        )}

        {activeModule === 'portfolio' && (
           <PortfolioGenerator 
              portfolioData={portfolioData} 
              setPortfolioData={setPortfolioData}
              onGenerateProject={handleGenerateProject}
              isLoading={loading}
              onCancelLoading={handleCancelLoading}
           />
        )}

        {activeModule === 'career' && (
            <CareerPathPredictor 
                projects={portfolioData.projects}
                resume={portfolioData.jobPackage.resume}
                onNavigateToResume={handleNavigateToResume}
                onDownloadComplete={handleDownloadComplete}
            />
        )}

        {activeModule === 'interview' && (
            <MockInterview jdText={jdText} portfolioData={portfolioData} />
        )}

      </main>

      <AIChatbot 
        portfolioData={portfolioData} 
        resumeContent={resumeContent} 
        jdText={jdText} 
        activeModule={activeModule}
        coachTrigger={coachTrigger}
      />

      {showDemoModal && !analysisResult && (
          <HackathonDemoModal 
            onRunSimulation={runDemoSimulation} 
            onClose={() => setShowDemoModal(false)} 
          />
      )}

      {activeModule === 'resume' && (
          <footer className="bg-white border-t border-slate-100 py-12">
            <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
               <p className="text-[12px] font-bold text-slate-400">Copyright © 2026 AI Fast Resume. All Rights Reserved.</p>
            </div>
          </footer>
      )}
    </div>
  );
}

export default App;
