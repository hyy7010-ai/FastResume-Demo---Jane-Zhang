
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ResumeContent, Experience, PortfolioData, Template, ReferenceItem, Project } from '../types';
import { TRANSLATIONS } from '../constants';

interface ResumePreviewProps {
  content: ResumeContent;
  allOriginalExperiences: Experience[]; 
  allOriginalVolunteer: Experience[];   
  coverLetter?: string;
  missingKeywords: string[];
  jdText: string;
  onUpdate: (newContent: ResumeContent) => void;
  onUpdateCoverLetter: (newCL: string) => void;
  onReOptimize?: (newJd: string) => void; 
  lang: 'en' | 'zh';
  portfolioData: PortfolioData;
  setPortfolioData: React.Dispatch<React.SetStateAction<PortfolioData>>;
}

const COLORS = {
  indigo: '#4f46e5',
  emerald: '#059669',
  slate: '#1e293b',
  rose: '#e11d48',
  blue: '#2563eb',
  royal: '#1e3a8a',
  teal: '#0d9488',
  purple: '#a855f7',
};

const FONT_OPTIONS = [
  { name: 'Jakarta', value: 'Plus Jakarta Sans' },
  { name: 'Inter', value: 'Inter' },
  { name: 'Lora', value: 'Lora' },
  { name: 'Merriweather', value: 'Merriweather' },
  { name: 'Playfair', value: 'Playfair Display' },
  { name: 'System', value: 'system-ui' },
];

const RESUME_TEMPLATES: { name: string; value: Template; description: string }[] = [
  { name: 'Minimalist', value: 'Minimalist', description: 'Clean & modern (Sans-serif)' },
  { name: 'Professional', value: 'Professional', description: 'Classic & structured (Serif)' },
  { name: 'Creative', value: 'Creative', description: 'Two-column, visually engaging' },
  { name: 'Academic', value: 'Academic', description: 'Education-first, detail-focused' },
  { name: 'Grid', value: 'Grid', description: 'Modern sidebar layout' },
];

const CL_TEMPLATES = [
  { name: 'Elegant', value: 'elegant', description: '(Decorative)' },
  { name: 'Professional', value: 'business', description: '(Business)' },
];

interface PageSettings {
  lineHeight: number;
  margin: number; 
  fontSize: number; 
  nameSize: number;   
  headerSize: number; 
}

const DEFAULT_SETTINGS: PageSettings = {
  lineHeight: 1.4,
  margin: 15, 
  fontSize: 10,
  nameSize: 28,
  headerSize: 11
};

export const ResumePreview: React.FC<ResumePreviewProps> = ({ 
  content, 
  allOriginalExperiences,
  allOriginalVolunteer,
  coverLetter = '',
  jdText,
  onUpdate, 
  onUpdateCoverLetter,
  onReOptimize,
  lang,
  portfolioData,
  setPortfolioData,
}) => {
  const [activeFont, setActiveFont] = useState<string>('Plus Jakarta Sans');
  const [activeTab, setActiveTab] = useState<'resume' | 'coverLetter'>('resume');
  const [clLayout, setClLayout] = useState<'elegant' | 'business'>('business');
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [zoom, setZoom] = useState(0.65); 
  const [activeEditingPage, setActiveEditingPage] = useState<number>(0);
  const [showHistoryPool, setShowHistoryPool] = useState(false);
  const [manualPageMap, setManualPageMap] = useState<Record<string, number>>({});
  const [manualPageCount, setManualPageCount] = useState<number>(1);
  const [coverLetterPageCount, setCoverLetterPageCount] = useState<number>(1);
  
  // Handling split content for cover letter pagination manually
  const [clPages, setClPages] = useState<string[]>(['']);

  const [customTitles, setCustomTitles] = useState({ portfolio: "Portfolio Highlights" });

  const [history, setHistory] = useState<ResumeContent[]>([]);
  const [future, setFuture] = useState<ResumeContent[]>([]);

  // State to toggle Portfolio Page visibility
  const [showPortfolio, setShowPortfolio] = useState(portfolioData.projects.length > 0);

  useEffect(() => {
      if (portfolioData.projects.length > 0) {
          setShowPortfolio(true);
      }
  }, [portfolioData.projects.length]);

  useEffect(() => {
      // Initialize Cover Letter Page 1
      if (coverLetter && clPages[0] === '') {
          setClPages([coverLetter]);
      }
  }, [coverLetter]);

  const handleUpdateCoverLetterPage = (idx: number, text: string) => {
      const newPages = [...clPages];
      newPages[idx] = text;
      setClPages(newPages);
      // Join with double newline to keep data sync, though visual pages are separate
      onUpdateCoverLetter(newPages.join('\n\n'));
  };

  const handleUpdateWithHistory = useCallback((newContent: ResumeContent) => {
      setHistory(prev => [...prev, content]);
      setFuture([]); 
      onUpdate(newContent);
  }, [content, onUpdate]);

  const handleUndo = useCallback(() => {
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      
      setFuture(prev => [content, ...prev]);
      setHistory(newHistory);
      onUpdate(previous);
  }, [history, content, onUpdate]);

  const handleRedo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);

      setHistory(prev => [...prev, content]);
      setFuture(newFuture);
      onUpdate(next);
  }, [future, content, onUpdate]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  handleRedo();
              } else {
                  handleUndo();
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const [newItem, setNewItem] = useState<{
      role: string;
      company: string;
      period: string;
      type: 'work' | 'volunteer' | 'project';
      description: string;
  }>({
      role: '',
      company: '',
      period: '',
      type: 'work',
      description: ''
  });

  const [allPageSettings, setAllPageSettings] = useState<Record<number, PageSettings>>({
    0: { ...DEFAULT_SETTINGS },
    1: { ...DEFAULT_SETTINGS },
    100: { ...DEFAULT_SETTINGS } 
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[lang];
  const currentThemeHex = (COLORS as any)[portfolioData.theme.color] || portfolioData.theme.color;
  const currentTemplate = portfolioData.theme.template;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const base64 = (ev.target?.result as string).split(',')[1];
              setPortfolioData(prev => ({
                  ...prev,
                  userProfile: { ...prev.userProfile, photo: base64 }
              }));
          };
          reader.readAsDataURL(file);
      }
  };

  const getItemPage = (id: string, index: number, type: 'work' | 'volunteer' | 'project'): number => {
      if (manualPageMap[id] !== undefined) return manualPageMap[id];
      if (type === 'work') return index < 3 ? 0 : 1;
      if (type === 'volunteer') return 1;
      if (type === 'project') return 1;
      return 0;
  };

  // Helper to determine if a section header should be shown on a specific page
  // Shows header if: It's Page 0 OR The previous page did NOT have items of this type (meaning it's a new section start)
  const shouldShowHeader = (pageItems: any[], allItems: any[], type: 'work' | 'volunteer' | 'project', pageIdx: number) => {
      if (!pageItems || pageItems.length === 0) return false;
      if (pageIdx === 0) return true;
      const prevPageHasItems = allItems.some((item, index) => getItemPage(item.id, index, type) === pageIdx - 1);
      return !prevPageHasItems;
  };

  // FIXED: Calculate max page strictly based on Resume Items + Manual Page Count
  // Does NOT include portfolio page logic here
  const maxResumePageIdx = useMemo(() => {
    let max = manualPageCount - 1;
    (content.experiences || []).forEach((e, i) => {
        const p = getItemPage(e.id, i, 'work');
        if (p > max) max = p;
    });
    (content.volunteer || []).forEach((v, i) => {
        const p = getItemPage(v.id, i, 'volunteer');
        if (p > max) max = p;
    });
    (content.schoolProjects || []).forEach((proj, i) => {
        const pg = getItemPage(proj.id, i, 'project');
        if (pg > max) max = pg;
    });
    return Math.max(0, max);
  }, [content.experiences, content.volunteer, content.schoolProjects, manualPageMap, manualPageCount]);

  const resumePageCount = maxResumePageIdx + 1;

  const currentSettings = activeTab === 'coverLetter' 
    ? (allPageSettings[100] || DEFAULT_SETTINGS) 
    : (allPageSettings[activeEditingPage] || DEFAULT_SETTINGS);

  const updateSettings = (newSettings: Partial<PageSettings>) => {
    const targetIdx = activeTab === 'coverLetter' ? 100 : activeEditingPage;
    setAllPageSettings(prev => ({
      ...prev,
      [targetIdx]: { ...prev[targetIdx], ...newSettings }
    }));
  };

  const handleSetThemeColor = (color: string) => {
    setPortfolioData(prev => ({ ...prev, theme: { ...prev.theme, color } }));
  };

  const handleSetTemplate = (template: Template) => {
    setPortfolioData(prev => ({ ...prev, theme: { ...prev.theme, template } }));
  };

  const handleAddReference = () => {
    const newRef: ReferenceItem = {
      id: `ref-${Date.now()}`,
      fullName: 'New Reference',
      jobTitle: 'Job Title',
      company: 'Company',
      contactInfo: 'Email / Phone',
      relationship: 'Professional Relationship'
    };
    handleUpdateWithHistory({ ...content, references: [...(content.references || []), newRef] });
  };

  const handleRemoveReference = (id: string) => {
    handleUpdateWithHistory({ ...content, references: (content.references || []).filter(r => r.id !== id) });
  };
  
  const handleAddNewFromModal = () => {
      const newExp: Experience = {
          id: `new-${Date.now()}`,
          role: newItem.role || 'New Role',
          company: newItem.company || 'New Company',
          period: newItem.period || 'Present',
          bullets: newItem.description ? newItem.description.split('\n') : ['Description...'],
          isMatch: false,
      };

      if (newItem.type === 'volunteer') {
          handleUpdateWithHistory({ ...content, volunteer: [...(content.volunteer || []), newExp] });
      } else if (newItem.type === 'project') {
          handleUpdateWithHistory({ ...content, schoolProjects: [...(content.schoolProjects || []), newExp] });
      } else {
          handleUpdateWithHistory({ ...content, experiences: [...(content.experiences || []), newExp] });
      }
      
      setNewItem({ role: '', company: '', period: '', type: 'work', description: '' });
      setShowHistoryPool(false);
  };
  
  const handleRemoveExperience = (id: string) => {
      handleUpdateWithHistory({ ...content, experiences: (content.experiences || []).filter(e => e.id !== id) });
  };
  
  const handleRemoveVolunteer = (id: string) => {
      handleUpdateWithHistory({ ...content, volunteer: (content.volunteer || []).filter(v => v.id !== id) });
  };

  const handleRemoveSchoolProject = (id: string) => {
      handleUpdateWithHistory({ ...content, schoolProjects: (content.schoolProjects || []).filter(p => p.id !== id) });
  };

  const handleAddReferenceField = (id: string, field: keyof ReferenceItem, value: string) => {
    handleUpdateWithHistory({
      ...content,
      references: (content.references || []).map(r => r.id === id ? { ...r, [field]: value } : r)
    });
  };

  const handleUpdateExperience = (id: string, field: keyof Experience, value: any) => {
      handleUpdateWithHistory({
          ...content,
          experiences: (content.experiences || []).map(e => e.id === id ? { ...e, [field]: value } : e)
      });
  };
  
  const handleUpdateVolunteer = (id: string, field: keyof Experience, value: any) => {
      handleUpdateWithHistory({
          ...content,
          volunteer: (content.volunteer || []).map(v => v.id === id ? { ...v, [field]: value } : v)
      });
  };

  const handleUpdateSchoolProject = (id: string, field: keyof Experience, value: any) => {
      handleUpdateWithHistory({
          ...content,
          schoolProjects: (content.schoolProjects || []).map(p => p.id === id ? { ...p, [field]: value } : p)
      });
  };

  const handleMoveToPage = (id: string, pageIdx: number) => {
      setManualPageMap(prev => ({ ...prev, [id]: pageIdx }));
  };

  const handleAddPage = () => {
      if (activeTab === 'coverLetter') {
          setCoverLetterPageCount(prev => prev + 1);
          setClPages(prev => [...prev, '']);
      } else {
          setManualPageCount(prev => prev + 1);
      }
  };
  
  // Updated: Just hides the page instead of clearing data
  const handleRemovePortfolio = (e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      // Just hide it, don't delete data
      setShowPortfolio(false);
  };

  const handleAddPortfolio = () => {
      if (portfolioData.projects.length === 0) {
          // Add placeholder project to prompt user
          const placeholder: Project = {
              id: 'placeholder-' + Date.now(),
              title: "Project Title",
              type: "Document",
              category: "Marketing Strategy",
              originalMimeType: "text/plain",
              base64Data: "",
              originalFileName: "placeholder.txt",
              description: "Description of your project goes here. Click 'Edit Content' to update this text or go to Portfolio AI to upload real files.",
              associatedSkills: ["Skill 1", "Skill 2"]
          };
          setPortfolioData(prev => ({ ...prev, projects: [placeholder] }));
      }
      setShowPortfolio(true);
  };

  const handleRemovePage = () => {
      if (activeTab === 'coverLetter') {
          if (coverLetterPageCount > 1) {
              setCoverLetterPageCount(prev => prev - 1);
              setClPages(prev => prev.slice(0, -1));
          }
      } else {
          // Priority 1: Remove Portfolio if it exists (it's the last visual page)
          if (showPortfolio) {
              handleRemovePortfolio();
              return;
          }

          // Priority 2: Remove Resume Page (even if it's the last one)
          handleDeletePage(resumePageCount - 1);
      }
  };

  const handleDeletePage = (targetPage: number) => {
      if (activeTab === 'coverLetter') {
          if (coverLetterPageCount <= 1) return;
          setCoverLetterPageCount(prev => prev - 1);
          setClPages(prev => prev.filter((_, i) => i !== targetPage));
          return;
      }

      // Allow deleting the last resume page -> Clears data
      if (resumePageCount === 1) {
          if (confirm("This is the only resume page. Clear all content?")) {
              const emptyContent = { ...content, experiences: [], education: [], volunteer: [], schoolProjects: [], summary: '' };
              handleUpdateWithHistory(emptyContent);
          }
          return;
      }

      const newMap = { ...manualPageMap };
      const processList = (list: Experience[], type: 'work' | 'volunteer' | 'project') => {
          list.forEach((item, index) => {
              const currentPage = getItemPage(item.id, index, type);
              if (currentPage === targetPage) {
                  // Move items from the deleted page to the previous page
                  newMap[item.id] = Math.max(0, targetPage - 1);
              } else if (currentPage > targetPage) {
                  // Shift subsequent pages up
                  newMap[item.id] = currentPage - 1;
              }
          });
      };

      processList(content.experiences || [], 'work');
      processList(content.volunteer || [], 'volunteer');
      processList(content.schoolProjects || [], 'project');

      setManualPageMap(newMap);
      setManualPageCount(prev => Math.max(1, prev - 1));
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    if (isEditing) {
        alert("Please save changes (click 'Save Changes') before exporting.");
        return;
    }

    const html2pdfLib = (window as any).html2pdf;
    if (!html2pdfLib) {
      alert("PDF library not loaded. Please refresh.");
      return;
    }

    setIsExporting(true);
    // 1. Scroll to top to ensure clean start
    window.scrollTo(0, 0);

    // 2. Create the "Stage"
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.top = '0';
    stage.style.left = '0';
    stage.style.width = '100%';
    stage.style.height = '100%';
    stage.style.zIndex = '99998'; // Below overlay
    stage.style.backgroundColor = '#ffffff';
    stage.style.overflow = 'auto';
    document.body.appendChild(stage);

    // 3. Create a Full Screen Loading Overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0.98);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: sans-serif;
    `;
    loadingOverlay.innerHTML = `
        <div style="
            width: 60px;
            height: 60px;
            border: 5px solid #e2e8f0;
            border-top: 5px solid #4f46e5;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 24px;
        "></div>
        <h2 style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 0 0 10px 0;">Generating PDF</h2>
        <p style="font-size: 14px; font-weight: 500; color: #64748b;">Please wait while we render your document...</p>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loadingOverlay);

    // 4. Create the Capture Target (The Pages)
    // We render this INSIDE the stage. 
    // IMPORTANT: Width set to strictly 210mm to align with PDF A4.
    const captureContainer = document.createElement('div');
    captureContainer.style.width = '210mm'; 
    captureContainer.style.margin = '0 auto'; 
    captureContainer.style.background = 'white';
    stage.appendChild(captureContainer);

    try {
      // 5. Clone Pages and append to capture container
      const originalPages = document.querySelectorAll('.a4-page');
      
      originalPages.forEach((page, index) => {
          const clone = page.cloneNode(true) as HTMLElement;
          
          // STRICT DIMENSIONING FOR PDF
          // Use 296.8mm - Slightly smaller than 297mm to absolutely prevent overflow blank pages
          // The 0.2mm difference is invisible but mathematically safe for all browsers
          clone.style.width = '210mm';
          clone.style.height = '296.8mm'; 
          clone.style.minHeight = '296.8mm';
          clone.style.maxHeight = '296.8mm';
          
          // Reset styles that might interfere
          clone.style.transform = 'none'; 
          clone.style.opacity = '1';
          clone.style.animation = 'none';
          clone.style.transition = 'none';
          clone.style.boxShadow = 'none';
          clone.style.margin = '0';
          clone.style.padding = '0'; 
          clone.style.border = 'none';
          clone.style.backgroundColor = 'white';
          clone.style.overflow = 'hidden'; // Vital to prevent spillover content creating blank pages
          clone.style.display = 'block';
          clone.style.position = 'relative';

          // Fix Flex themes to fill height AND sidebar colors
          const creativeTheme = clone.querySelector('.theme-creative');
          if (creativeTheme) {
              (creativeTheme as HTMLElement).style.height = '100%';
              (creativeTheme as HTMLElement).style.minHeight = 'unset';
              const sidebar = creativeTheme.firstElementChild as HTMLElement;
              if (sidebar) {
                  sidebar.style.height = '100%';
                  sidebar.style.minHeight = 'unset';
              }
          }
          
          const gridTheme = clone.querySelector('.theme-grid');
          if (gridTheme) {
              (gridTheme as HTMLElement).style.height = '100%';
              (gridTheme as HTMLElement).style.minHeight = 'unset';
              const sidebar = gridTheme.firstElementChild as HTMLElement;
              if (sidebar) {
                  sidebar.style.height = '100%';
                  sidebar.style.minHeight = 'unset';
              }
          }

          // IMPORTANT: Handle Page Breaks via CSS
          // Page break AFTER every page forces clean separation
          // We avoid 'before' to prevent an initial blank page
          if (index < originalPages.length - 1) {
              clone.style.pageBreakAfter = 'always';
          } else {
              clone.style.pageBreakAfter = 'avoid';
          }

          captureContainer.appendChild(clone);
      });

      // 6. Wait for DOM paint/images
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 7. Generate PDF
      const safeName = content.fullName.replace(/\s+/g, '_') || 'Resume';
      const jobTitle = content.targetJobTitle || 'Job';
      const docType = activeTab === 'coverLetter' ? 'Cover_Letter' : 'Resume';
      const filename = `${safeName}_${jobTitle}_${docType}.pdf`;
      
      const opt = { 
        margin: 0, // Zero margin, we handle content padding internally
        filename: filename, 
        image: { type: 'jpeg', quality: 1.0 }, 
        html2canvas: { 
          scale: 2, // High resolution (approx 192dpi)
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
        }, 
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        },
        pagebreak: { mode: ['css', 'legacy'] } 
      };

      await html2pdfLib().set(opt).from(captureContainer).save();

    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("An error occurred during export. Please try again.");
    } finally {
      // 8. Cleanup
      document.body.removeChild(stage);
      document.body.removeChild(loadingOverlay);
      setIsExporting(false);
    }
  };

  const FullEditable = ({ value, onChange, style: extraStyle = {}, tagName: Tag = "div", multiLine = false, className = "" }: any) => {
    const baseStyle: React.CSSProperties = { whiteSpace: 'pre-wrap', ...extraStyle };
    if (!isEditing) return <Tag className={className} style={baseStyle}>{value || ''}</Tag>;
    return (
      <Tag
        contentEditable suppressContentEditableWarning
        onBlur={(e: any) => onChange(e.target.innerText)}
        className={`${className} outline-none ring-2 ring-indigo-500/20 rounded px-1 transition-all bg-indigo-50/10 hover:bg-white focus:bg-white z-20 relative`}
        style={baseStyle}
      >{value || ''}</Tag>
    );
  };

  // ... (Components like ReferenceSection, EducationSection, ExperienceItem remain unchanged)
  const ReferenceSection = ({ bodyStyle, headerStyle }: { bodyStyle: any, headerStyle?: any }) => {
    if (!content.references || content.references.length === 0) return null;
    return (
      <section className="mt-8 pt-6 border-t border-slate-200">
        <h3 className="uppercase font-black tracking-widest mb-4" style={{ color: currentThemeHex, ...headerStyle }}>REFERENCES</h3>
        <div className="grid grid-cols-2 gap-6">
          {content.references.map((ref) => (
            <div key={ref.id} className="relative group">
               {isEditing && <button onClick={() => handleRemoveReference(ref.id)} className="absolute -right-2 top-0 no-print text-rose-500 font-bold text-xs opacity-0 group-hover:opacity-100">x</button>}
               <FullEditable tagName="div" value={ref.fullName} onChange={(v: string) => handleAddReferenceField(ref.id, 'fullName', v)} style={{ fontWeight: 800, fontSize: `${parseFloat(bodyStyle.fontSize) + 1}pt` }} />
               <div className="text-slate-500 text-[9pt]">
                 <FullEditable value={`${ref.jobTitle} at ${ref.company}`} onChange={() => {}} />
                 <FullEditable value={ref.contactInfo} onChange={(v: string) => handleAddReferenceField(ref.id, 'contactInfo', v)} />
               </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const EducationSection = ({ bodyStyle, headerStyle, simple = false }: { bodyStyle: any, headerStyle?: any, simple?: boolean }) => {
      if (!content.education || content.education.length === 0) return null;
      return (
        <section className="mb-6">
           <h3 className="uppercase font-black tracking-widest mb-3 border-b border-slate-100 pb-2" style={{ color: currentThemeHex, ...headerStyle }}>EDUCATION</h3>
           {content.education.map((edu, i) => (
               <div key={i} className="mb-3">
                   {simple ? (
                       <div className="text-sm">
                           <FullEditable value={edu.school} className="font-bold" onChange={(v: string) => {}} />
                           <div className="flex justify-between text-slate-500 italic text-xs">
                               <FullEditable value={edu.degree} onChange={(v: string) => {}} />
                               <FullEditable value={edu.endDate} onChange={(v: string) => {}} />
                           </div>
                       </div>
                   ) : (
                       <>
                           <div className="flex justify-between font-bold text-[10.5pt]">
                               <FullEditable value={edu.school} onChange={(v: string) => {}} />
                               <FullEditable value={`${edu.startDate} - ${edu.endDate}`} className="text-slate-400 font-medium text-[9pt]" onChange={(v: string) => {}} />
                           </div>
                           <FullEditable value={edu.degree} className="text-slate-600 italic text-[9.5pt]" onChange={(v: string) => {}} />
                       </>
                   )}
               </div>
           ))}
        </section>
      );
  }

  const ExperienceItem: React.FC<{ exp: Experience, bodyStyle: any, type?: 'work' | 'volunteer' | 'project' }> = ({ exp, bodyStyle, type = 'work' }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [isEditing, exp.bullets]);

    const updateField = (field: keyof Experience, val: any) => {
        if (type === 'volunteer') handleUpdateVolunteer(exp.id, field, val);
        else if (type === 'project') handleUpdateSchoolProject(exp.id, field, val);
        else handleUpdateExperience(exp.id, field, val);
    };

    const removeSelf = () => {
        if (type === 'volunteer') handleRemoveVolunteer(exp.id);
        else if (type === 'project') handleRemoveSchoolProject(exp.id);
        else handleRemoveExperience(exp.id);
    };

    return (
        <div className="relative mb-6 group">
        {isEditing && (
            <div className="absolute top-0 right-0 flex gap-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                <button onClick={() => handleMoveToPage(exp.id, 0)} className="bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-1 rounded shadow-sm hover:bg-slate-300">P1</button>
                <button onClick={() => handleMoveToPage(exp.id, 1)} className="bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-1 rounded shadow-sm hover:bg-slate-300">P2</button>
                <button onClick={removeSelf} className="bg-rose-500 text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm hover:bg-rose-600 ml-2">REMOVE</button>
            </div>
        )}
        <div className="flex justify-between items-baseline mb-1">
            <FullEditable tagName="span" value={exp.role} style={{ fontSize: `${parseFloat(bodyStyle.fontSize) + 1}pt`, fontWeight: 800, color: '#1e293b' }} onChange={(v: string) => updateField('role', v)} />
            <FullEditable tagName="span" value={exp.period} style={{ fontSize: `${parseFloat(bodyStyle.fontSize) - 1}pt`, color: '#64748b', fontWeight: 600 }} onChange={(v: string) => updateField('period', v)} />
        </div>
        <FullEditable tagName="div" value={exp.company} style={{ fontSize: `${parseFloat(bodyStyle.fontSize)}pt`, color: currentThemeHex, fontWeight: 700, marginBottom: '6px' }} onChange={(v: string) => updateField('company', v)} />
        
        <div className={`pl-4 ${isEditing ? 'border-l-2 border-indigo-100/50' : ''}`}>
            {isEditing ? (
                <textarea 
                    ref={textareaRef}
                    className="w-full bg-indigo-50/20 p-2 rounded text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 resize-none overflow-hidden"
                    value={exp.bullets.join('\n')}
                    onChange={(e) => {
                        updateField('bullets', e.target.value.split('\n'));
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    style={{ fontSize: `${parseFloat(bodyStyle.fontSize)}pt`, lineHeight: 1.4 }}
                />
            ) : (
                <ul className="bullet-list-ul space-y-1.5" style={bodyStyle}>
                    {exp.bullets.map((b: string, i: number) => (
                        <li key={i} className="relative">
                            <span>{b}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        </div>
    );
  };

  const BottomActions = () => (
      <div className={`mt-8 pt-6 border-t border-dashed border-slate-200 flex flex-wrap gap-4 transition-opacity no-print`}>
          <button onClick={() => setShowHistoryPool(true)} className="px-6 py-3 bg-[#4f46e5] text-white rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200/50">
              <span>+ EXPERIENCE / HISTORY</span>
          </button>
          <button onClick={handleAddReference} className="px-6 py-3 bg-[#eff6ff] text-[#4f46e5] hover:bg-indigo-100 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
              <span>+ REFERENCE</span>
          </button>
      </div>
  );

  // ... (Layout components MinimalistLayout, ProfessionalLayout, CreativeLayout, AcademicLayout, GridLayout remain mostly same)
  // I will just copy them back to ensure they are present.

  const MinimalistLayout = ({ pageIdx }: { pageIdx: number }) => {
    const settings = allPageSettings[pageIdx] || DEFAULT_SETTINGS;
    const bodyStyle = { fontSize: `${settings.fontSize}pt`, lineHeight: settings.lineHeight };
    const headerStyle = { fontSize: `${settings.headerSize}pt` };
    const pageExps = (content.experiences || []).filter((e, idx) => getItemPage(e.id, idx, 'work') === pageIdx);
    const pageVols = (content.volunteer || []).filter((v, idx) => getItemPage(v.id, idx, 'volunteer') === pageIdx);
    const pageProjs = (content.schoolProjects || []).filter((p, idx) => getItemPage(p.id, idx, 'project') === pageIdx);
    const isLastPage = pageIdx === resumePageCount - 1;

    return (
      <div className="a4-page-content theme-minimalist h-full flex flex-col" style={{ padding: `${settings.margin}mm`, fontFamily: activeFont }}>
        {pageIdx === 0 && (
          <header className="mb-10">
            <FullEditable tagName="h1" value={content.fullName} style={{ fontSize: `${settings.nameSize}pt`, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }} onChange={(v: string) => handleUpdateWithHistory({...content, fullName: v})} />
            <div className="h-1.5 w-16 mt-4 mb-4 rounded-full" style={{ backgroundColor: currentThemeHex }}></div>
            <FullEditable tagName="p" value={content.contactInfo} className="text-slate-500 font-bold uppercase tracking-widest text-[10px]" onChange={(v: string) => handleUpdateWithHistory({...content, contactInfo: v})} />
          </header>
        )}
        <div className="space-y-8 flex-grow">
           {pageIdx === 0 && (
             <section>
               <h3 className="uppercase font-black tracking-widest mb-4 border-b border-slate-100 pb-2" style={{ color: currentThemeHex, ...headerStyle }}>PROFESSIONAL SUMMARY</h3>
               <FullEditable multiLine value={content.summary} style={bodyStyle} onChange={(v: string) => handleUpdateWithHistory({...content, summary: v})} />
             </section>
           )}
           {pageIdx === 0 && <EducationSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
           {(pageExps.length > 0) && (
             <section>
               {shouldShowHeader(pageExps, content.experiences, 'work', pageIdx) && <h3 className="uppercase font-black tracking-widest mb-6 border-b border-slate-100 pb-2" style={{ color: currentThemeHex, ...headerStyle }}>PROFESSIONAL EXPERIENCE</h3>}
               {pageExps.map((exp, idx) => <ExperienceItem key={exp.id} exp={exp} bodyStyle={bodyStyle} type="work" />)}
             </section>
           )}
           {(pageProjs.length > 0) && (
             <section>
                {shouldShowHeader(pageProjs, content.schoolProjects, 'project', pageIdx) && <h3 className="uppercase font-black tracking-widest mb-6 border-b border-slate-100 pb-2" style={{ color: currentThemeHex, ...headerStyle }}>SCHOOL PROJECTS</h3>}
                {pageProjs.map((proj, idx) => <ExperienceItem key={proj.id} exp={proj} bodyStyle={bodyStyle} type="project" />)}
             </section>
           )}
           {(pageVols.length > 0) && (
             <section>
               {shouldShowHeader(pageVols, content.volunteer, 'volunteer', pageIdx) && <h3 className="uppercase font-black tracking-widest mb-6 border-b border-slate-100 pb-2" style={{ color: currentThemeHex, ...headerStyle }}>VOLUNTEER EXPERIENCE</h3>}
               {pageVols.map((vol, idx) => (
                 <div key={vol.id} className="relative">
                   <ExperienceItem key={vol.id} exp={vol} bodyStyle={bodyStyle} type="volunteer" />
                 </div>
               ))}
             </section>
           )}
           {isLastPage && <ReferenceSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
           {isLastPage && <BottomActions />}
        </div>
      </div>
    );
  };

  const ProfessionalLayout = ({ pageIdx }: { pageIdx: number }) => {
    const settings = allPageSettings[pageIdx] || DEFAULT_SETTINGS;
    const bodyStyle = { fontSize: `${settings.fontSize}pt`, lineHeight: settings.lineHeight };
    const headerStyle = { fontSize: `${settings.headerSize}pt` };
    const pageExps = (content.experiences || []).filter((e, idx) => getItemPage(e.id, idx, 'work') === pageIdx);
    const pageVols = (content.volunteer || []).filter((v, idx) => getItemPage(v.id, idx, 'volunteer') === pageIdx);
    const pageProjs = (content.schoolProjects || []).filter((p, idx) => getItemPage(p.id, idx, 'project') === pageIdx);
    const isLastPage = pageIdx === resumePageCount - 1; 

    return (
      <div className="a4-page-content theme-professional h-full flex flex-col" style={{ padding: `${settings.margin}mm`, fontFamily: activeFont === 'System' ? 'Times New Roman' : activeFont }}>
        {pageIdx === 0 && (
          <header className="mb-8 text-center border-b-2 border-slate-800 pb-6">
            <FullEditable tagName="h1" value={content.fullName} style={{ fontSize: `${settings.nameSize}pt`, fontWeight: 700, color: '#000', lineHeight: 1.1, marginBottom: '10px' }} onChange={(v: string) => handleUpdateWithHistory({...content, fullName: v})} />
            <FullEditable tagName="p" value={content.contactInfo} className="text-slate-600 font-medium text-[10pt]" onChange={(v: string) => handleUpdateWithHistory({...content, contactInfo: v})} />
          </header>
        )}
        <div className="space-y-6 flex-grow">
           {pageIdx === 0 && (
             <section>
               <h3 className="uppercase font-bold tracking-wider mb-3 border-b border-slate-300 pb-1" style={{ color: currentThemeHex, ...headerStyle }}>PROFESSIONAL SUMMARY</h3>
               <FullEditable multiLine value={content.summary} style={bodyStyle} onChange={(v: string) => handleUpdateWithHistory({...content, summary: v})} />
             </section>
           )}
           {pageIdx === 0 && <EducationSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
           {(pageExps.length > 0) && (
             <section>
               {shouldShowHeader(pageExps, content.experiences, 'work', pageIdx) && <h3 className="uppercase font-bold tracking-wider mb-4 border-b border-slate-300 pb-1" style={{ color: currentThemeHex, ...headerStyle }}>PROFESSIONAL EXPERIENCE</h3>}
               {pageExps.map((exp, idx) => <ExperienceItem key={exp.id} exp={exp} bodyStyle={bodyStyle} type="work" />)}
             </section>
           )}
           {pageProjs.length > 0 && (
              <section>
                  {shouldShowHeader(pageProjs, content.schoolProjects, 'project', pageIdx) && <h3 className="uppercase font-bold tracking-wider mb-4 border-b border-slate-300 pb-1" style={{ color: currentThemeHex, ...headerStyle }}>SCHOOL PROJECTS</h3>}
                  {pageProjs.map((p, idx) => <ExperienceItem key={p.id} exp={p} bodyStyle={bodyStyle} type="project" />)}
              </section>
           )}
           {(pageVols.length > 0) && (
             <section>
               {shouldShowHeader(pageVols, content.volunteer, 'volunteer', pageIdx) && <h3 className="uppercase font-bold tracking-wider mb-4 border-b border-slate-300 pb-1" style={{ color: currentThemeHex, ...headerStyle }}>LEADERSHIP & VOLUNTEERING</h3>}
               {pageVols.map((vol, idx) => <ExperienceItem key={vol.id} exp={vol} bodyStyle={bodyStyle} type="volunteer" />)}
             </section>
           )}
           {isLastPage && <ReferenceSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
           {isLastPage && <BottomActions />}
        </div>
      </div>
    );
  };

  const CreativeLayout = ({ pageIdx }: { pageIdx: number }) => {
      const settings = allPageSettings[pageIdx] || DEFAULT_SETTINGS;
      const bodyStyle = { fontSize: `${settings.fontSize}pt`, lineHeight: settings.lineHeight };
      const headerStyle = { fontSize: `${settings.headerSize}pt` };
      const pageExps = (content.experiences || []).filter((e, idx) => getItemPage(e.id, idx, 'work') === pageIdx);
      const pageVols = (content.volunteer || []).filter((v, idx) => getItemPage(v.id, idx, 'volunteer') === pageIdx);
      const pageProjs = (content.schoolProjects || []).filter((p, idx) => getItemPage(p.id, idx, 'project') === pageIdx);
      const isLastPage = pageIdx === resumePageCount - 1; 

      return (
        <div className="a4-page-content theme-creative h-full flex min-h-[297mm]" style={{ fontFamily: activeFont }}>
          <div className="w-[30%] bg-slate-50 h-full p-8 border-r border-slate-100 flex flex-col gap-8 relative z-10 min-h-[297mm]" style={{ padding: `${settings.margin}mm` }}>
              {pageIdx === 0 && (
                  <div className="mb-4">
                      <div className="w-24 h-24 rounded-full bg-slate-200 mb-6 overflow-hidden relative cursor-pointer group z-20" onClick={() => isEditing && avatarInputRef.current?.click()}>
                          {portfolioData.userProfile.photo 
                              ? <img src={`data:image/jpeg;base64,${portfolioData.userProfile.photo}`} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-slate-400" style={{backgroundColor: currentThemeHex, color: 'white'}}>{content.fullName.charAt(0)}</div>
                          }
                      </div>
                      <FullEditable tagName="h1" value={content.fullName} style={{ fontSize: `${settings.nameSize}pt`, fontWeight: 900, color: currentThemeHex, lineHeight: 1.1, marginBottom: '10px' }} onChange={(v: string) => handleUpdateWithHistory({...content, fullName: v})} />
                      <FullEditable tagName="div" value={content.contactInfo} className="text-slate-500 font-bold text-[9pt] leading-relaxed" onChange={(v: string) => handleUpdateWithHistory({...content, contactInfo: v})} />
                  </div>
              )}
              {pageIdx === 0 && <EducationSection bodyStyle={{...bodyStyle, fontSize: '9pt'}} headerStyle={headerStyle} simple />}
              {pageIdx === 0 && <div><h3 className="uppercase font-black mb-4" style={{ color: currentThemeHex, ...headerStyle }}>SKILLS</h3><div className="flex flex-wrap gap-2">{content.technicalSkills.map((s, i) => <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-[8pt] font-bold text-slate-600">{s}</span>)}</div></div>}
          </div>
          <div className="w-[70%] p-8 flex flex-col z-0" style={{ padding: `${settings.margin}mm` }}>
              <div className="space-y-8 flex-grow">
                 {pageIdx === 0 && <section><h3 className="uppercase font-black mb-4" style={{ color: currentThemeHex, ...headerStyle }}>PROFILE</h3><FullEditable multiLine value={content.summary} style={bodyStyle} onChange={(v: string) => handleUpdateWithHistory({...content, summary: v})} /></section>}
                 {(pageExps.length > 0) && <section>{shouldShowHeader(pageExps, content.experiences, 'work', pageIdx) && <h3 className="uppercase font-black mb-6" style={{ color: currentThemeHex, ...headerStyle }}>PROFESSIONAL EXPERIENCE</h3>}{pageExps.map((exp, idx) => <ExperienceItem key={exp.id} exp={exp} bodyStyle={bodyStyle} type="work" />)}</section>}
                 {pageProjs.length > 0 && <section>{shouldShowHeader(pageProjs, content.schoolProjects, 'project', pageIdx) && <h3 className="uppercase font-black mb-6" style={{ color: currentThemeHex, ...headerStyle }}>PROJECTS</h3>}{pageProjs.map((p, idx) => <ExperienceItem key={p.id} exp={p} bodyStyle={bodyStyle} type="project" />)}</section>}
                 {pageVols.length > 0 && <section>{shouldShowHeader(pageVols, content.volunteer, 'volunteer', pageIdx) && <h3 className="uppercase font-black mb-6" style={{ color: currentThemeHex, ...headerStyle }}>VOLUNTEER</h3>}{pageVols.map((vol, idx) => <ExperienceItem key={vol.id} exp={vol} bodyStyle={bodyStyle} type="volunteer" />)}</section>}
                 {isLastPage && <ReferenceSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
                 {isLastPage && <BottomActions />}
              </div>
          </div>
        </div>
      );
  };

  const AcademicLayout = ({ pageIdx }: { pageIdx: number }) => {
      const settings = allPageSettings[pageIdx] || DEFAULT_SETTINGS;
      const bodyStyle = { fontSize: `${settings.fontSize}pt`, lineHeight: settings.lineHeight };
      const headerStyle = { fontSize: `${settings.headerSize}pt` };
      const pageExps = (content.experiences || []).filter((e, idx) => getItemPage(e.id, idx, 'work') === pageIdx);
      const pageVols = (content.volunteer || []).filter((v, idx) => getItemPage(v.id, idx, 'volunteer') === pageIdx);
      const pageProjs = (content.schoolProjects || []).filter((p, idx) => getItemPage(p.id, idx, 'project') === pageIdx);
      const isLastPage = pageIdx === resumePageCount - 1; 
      
      return (
        <div className="a4-page-content theme-academic h-full flex flex-col" style={{ padding: `${settings.margin}mm`, fontFamily: 'Times New Roman, serif' }}>
            {pageIdx === 0 && (
                <header className="mb-6 text-center border-b-2 border-black pb-4">
                    <FullEditable tagName="h1" value={content.fullName} style={{ fontSize: `${settings.nameSize}pt`, fontWeight: 'bold' }} onChange={(v: string) => handleUpdateWithHistory({...content, fullName: v})} />
                    <FullEditable tagName="p" value={content.contactInfo} style={{ fontSize: '10pt', marginTop: '4px' }} onChange={(v: string) => handleUpdateWithHistory({...content, contactInfo: v})} />
                </header>
            )}
            <div className="space-y-6">
                 {pageIdx === 0 && <EducationSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
                 {pageIdx === 0 && <section><h3 className="uppercase font-bold border-b border-black mb-3" style={{ color: currentThemeHex, ...headerStyle }}>SUMMARY</h3><FullEditable multiLine value={content.summary} style={bodyStyle} onChange={(v: string) => handleUpdateWithHistory({...content, summary: v})} /></section>}
                 {(pageExps.length > 0) && <section>{shouldShowHeader(pageExps, content.experiences, 'work', pageIdx) && <h3 className="uppercase font-bold border-b border-black mb-3" style={{ color: currentThemeHex, ...headerStyle }}>EXPERIENCE</h3>}{pageExps.map((exp, idx) => <div key={exp.id} className="mb-4"><ExperienceItem exp={exp} bodyStyle={bodyStyle} type="work" /></div>)}</section>}
                 {(pageProjs.length > 0) && <section>{shouldShowHeader(pageProjs, content.schoolProjects, 'project', pageIdx) && <h3 className="uppercase font-bold border-b border-black mb-3" style={{ color: currentThemeHex, ...headerStyle }}>PROJECTS</h3>}{pageProjs.map((p, idx) => <div key={p.id} className="mb-4"><ExperienceItem exp={p} bodyStyle={bodyStyle} type="project" /></div>)}</section>}
                 {(pageVols.length > 0) && <section>{shouldShowHeader(pageVols, content.volunteer, 'volunteer', pageIdx) && <h3 className="uppercase font-bold border-b border-black mb-3" style={{ color: currentThemeHex, ...headerStyle }}>VOLUNTEER</h3>}{pageVols.map((v, idx) => <div key={v.id} className="mb-4"><ExperienceItem exp={v} bodyStyle={bodyStyle} type="volunteer" /></div>)}</section>}
            </div>
            {isLastPage && <ReferenceSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
            {isLastPage && <BottomActions />}
        </div>
      );
  };

  const GridLayout = ({ pageIdx }: { pageIdx: number }) => {
      const settings = allPageSettings[pageIdx] || DEFAULT_SETTINGS;
      const bodyStyle = { fontSize: `${settings.fontSize}pt`, lineHeight: settings.lineHeight };
      const headerStyle = { fontSize: `${settings.headerSize}pt` };
      const pageExps = (content.experiences || []).filter((e, idx) => getItemPage(e.id, idx, 'work') === pageIdx);
      const pageVols = (content.volunteer || []).filter((v, idx) => getItemPage(v.id, idx, 'volunteer') === pageIdx);
      const pageProjs = (content.schoolProjects || []).filter((p, idx) => getItemPage(p.id, idx, 'project') === pageIdx);
      const isLastPage = pageIdx === resumePageCount - 1;
      
      return (
        <div className="a4-page-content theme-grid h-full flex min-h-[297mm]" style={{ fontFamily: activeFont, backgroundColor: '#f8fafc' }}>
            <div className="w-[35%] h-full p-6 text-white flex flex-col gap-6 min-h-[297mm]" style={{ backgroundColor: currentThemeHex, padding: `${settings.margin}mm` }}>
                {pageIdx === 0 && (
                    <div className="text-center mb-4 flex flex-col items-center">
                        <div 
                            className="w-24 h-24 rounded-full bg-white/10 mb-4 overflow-hidden relative cursor-pointer group border-4 border-white/10 shadow-sm"
                            onClick={() => isEditing && avatarInputRef.current?.click()}
                            title={isEditing ? "Click to change photo" : ""}
                        >
                             {portfolioData.userProfile.photo 
                                ? <img src={`data:image/jpeg;base64,${portfolioData.userProfile.photo}`} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/30">{content.fullName.charAt(0)}</div>
                             }
                             {isEditing && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                             )}
                        </div>
                        
                        <FullEditable tagName="h1" value={content.fullName} style={{ fontSize: `${settings.nameSize}pt` }} className="font-black mb-2" onChange={(v: string) => handleUpdateWithHistory({...content, fullName: v})} />
                        <FullEditable tagName="p" value={content.contactInfo} className="text-[8pt] opacity-90 break-words" onChange={(v: string) => handleUpdateWithHistory({...content, contactInfo: v})} />
                    </div>
                )}
                {pageIdx === 0 && <div className="bg-white/10 p-4 rounded-xl"><h3 className="font-black uppercase border-b border-white/30 pb-2 mb-3" style={headerStyle}>EDUCATION</h3>{content.education.map((e,i)=><div key={i} className="mb-3 text-[8pt]"><div>{e.school}</div><div className="italic">{e.degree}</div></div>)}</div>}
                {pageIdx === 0 && <div className="bg-white/10 p-4 rounded-xl"><h3 className="font-black uppercase border-b border-white/30 pb-2 mb-3" style={headerStyle}>SKILLS</h3><div className="flex flex-wrap gap-1">{content.technicalSkills.map((s,i)=><span key={i} className="bg-white/20 px-1.5 py-0.5 rounded text-[7pt]">{s}</span>)}</div></div>}
            </div>
            <div className="w-[65%] p-8 h-full flex flex-col gap-6" style={{ padding: `${settings.margin}mm` }}>
                 {pageIdx === 0 && <section className="bg-white p-5 rounded-xl border border-slate-200"><h3 className="font-black uppercase mb-2" style={{color:currentThemeHex, ...headerStyle}}>PROFILE</h3><FullEditable multiLine value={content.summary} style={bodyStyle} onChange={(v:string)=>handleUpdateWithHistory({...content, summary:v})} /></section>}
                 {pageExps.length > 0 && <section className="bg-white p-5 rounded-xl border border-slate-200">{shouldShowHeader(pageExps, content.experiences, 'work', pageIdx) && <h3 className="font-black uppercase mb-4" style={{color:currentThemeHex, ...headerStyle}}>EXPERIENCE</h3>}{pageExps.map((e,i)=><div key={e.id} className="mb-6"><ExperienceItem exp={e} bodyStyle={bodyStyle} type="work"/></div>)}</section>}
                 {pageProjs.length > 0 && <section className="bg-white p-5 rounded-xl border border-slate-200">{shouldShowHeader(pageProjs, content.schoolProjects, 'project', pageIdx) && <h3 className="font-black uppercase mb-4" style={{color:currentThemeHex, ...headerStyle}}>PROJECTS</h3>}{pageProjs.map((p,i)=><div key={p.id} className="mb-6"><ExperienceItem exp={p} bodyStyle={bodyStyle} type="project"/></div>)}</section>}
                 {pageVols.length > 0 && <section className="bg-white p-5 rounded-xl border border-slate-200">{shouldShowHeader(pageVols, content.volunteer, 'volunteer', pageIdx) && <h3 className="font-black uppercase mb-4" style={{color:currentThemeHex, ...headerStyle}}>VOLUNTEER</h3>}{pageVols.map((v,i)=><div key={v.id} className="mb-6"><ExperienceItem exp={v} bodyStyle={bodyStyle} type="volunteer"/></div>)}</section>}
                 {isLastPage && <ReferenceSection bodyStyle={bodyStyle} headerStyle={headerStyle} />}
                 {isLastPage && <BottomActions />}
            </div>
        </div>
      );
  };

  const PortfolioLayout = ({ pageIdx }: { pageIdx: number }) => {
    return (
        <div className="a4-page-content theme-portfolio h-full flex flex-col" style={{ padding: '20mm', fontFamily: activeFont }}>
            <div className="flex justify-between items-center mb-8 border-b-2 pb-2" style={{ borderColor: currentThemeHex }}>
                <FullEditable 
                    tagName="h2" 
                    value={customTitles.portfolio}
                    className="text-xl font-black uppercase tracking-widest" 
                    style={{ color: currentThemeHex }} 
                    onChange={(v: string) => setCustomTitles({...customTitles, portfolio: v})} 
                />
            </div>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-10">
                {portfolioData.projects.slice(0, 4).map((p) => (
                    <div key={p.id} className="break-inside-avoid">
                        <div className="aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden border border-slate-200 mb-4 shadow-sm relative">
                            {p.originalMimeType.startsWith('image/') ? <img src={`data:${p.originalMimeType};base64,${p.base64Data}`} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 font-bold text-xs">DOC</div>}
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 mb-2 leading-tight">{p.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-4">{p.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const CoverLetterPreview = ({ pageIdx }: { pageIdx: number }) => {
    const settings = allPageSettings[100] || DEFAULT_SETTINGS;
    const bodyStyle = { fontSize: `${settings.fontSize}pt`, lineHeight: settings.lineHeight };
    const isElegant = clLayout === 'elegant';
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === coverLetterPageCount - 1;

    return (
        <div className="a4-page-content theme-coverletter h-full flex flex-col" style={{ padding: `${settings.margin}mm`, fontFamily: activeFont }}>
            {isFirstPage && (
                <header className={`mb-8 ${isElegant ? 'text-center border-b pb-6 border-slate-100' : ''}`}>
                    <FullEditable tagName="h1" value={content.fullName} style={{ fontSize: `${settings.nameSize}pt`, fontWeight: 900, color: isElegant ? currentThemeHex : '#0f172a', lineHeight: 1.1 }} onChange={(v: string) => handleUpdateWithHistory({...content, fullName: v})} />
                    <FullEditable tagName="p" value={content.contactInfo} className={`text-slate-500 font-bold uppercase tracking-widest text-[9pt] mt-2 ${isElegant ? 'justify-center' : ''}`} onChange={(v: string) => handleUpdateWithHistory({...content, contactInfo: v})} />
                </header>
            )}
            
            {isFirstPage && (
                <div className="mb-6 text-[10pt] text-slate-800">
                    <div className="mb-4 font-bold text-slate-400 text-xs uppercase tracking-widest">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    {/* Add Job Title Here */}
                    <div className="mb-4 font-black text-sm uppercase tracking-wider text-indigo-600 border-b border-indigo-100 pb-1 inline-block">
                        RE: <FullEditable value={content.targetJobTitle || 'Job Application'} onChange={(v: string) => handleUpdateWithHistory({...content, targetJobTitle: v})} />
                    </div>
                    <div className="space-y-1"><FullEditable value={content.recipientName || 'Hiring Manager'} className="font-black" onChange={(v: string) => handleUpdateWithHistory({...content, recipientName: v})} /><FullEditable value={content.targetCompany || 'Target Company'} className="font-medium" onChange={(v: string) => handleUpdateWithHistory({...content, targetCompany: v})} /><FullEditable value={content.targetAddress || ''} placeholder="Company Address" className="text-slate-500" onChange={(v: string) => handleUpdateWithHistory({...content, targetAddress: v})} /></div>
                </div>
            )}

            <div className="flex-grow relative">
                 <FullEditable 
                    multiLine 
                    value={clPages[pageIdx] || (isFirstPage ? 'Dear Hiring Manager...' : '')} 
                    style={bodyStyle} 
                    onChange={(v: string) => handleUpdateCoverLetterPage(pageIdx, v)} 
                    className="min-h-[200px]"
                    placeholder={isFirstPage ? "Write your cover letter..." : "Additional text..."}
                 />
            </div>

            {isLastPage && (
                <div className="mt-8"><p className="font-bold text-[10pt] mb-4 text-slate-900">Sincerely,</p>{isElegant && <div className="font-['Dancing_Script'] text-3xl text-slate-800 mb-2">{content.fullName}</div>}<FullEditable value={content.fullName} className="font-black text-[12pt] text-slate-900" onChange={() => {}} /></div>
            )}
        </div>
    );
  };

  return (
    <div className="w-full bg-white min-h-screen flex border-t border-slate-200">
      <aside className="w-[380px] bg-white border-r border-slate-100 p-8 flex flex-col h-[calc(100vh-80px)] sticky top-20 z-30 overflow-y-auto no-print custom-scrollbar">
         <div className="space-y-12">
          <div className="space-y-6">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">
              {activeTab === 'resume' ? 'Resume Layouts' : 'Cover Letter Layouts'}
            </h2>
            <div className={`grid ${activeTab === 'resume' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              {activeTab === 'resume' ? (
                RESUME_TEMPLATES.map(opt => (
                  <button key={opt.value} onClick={() => handleSetTemplate(opt.value)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1 ${currentTemplate === opt.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border-slate-50 text-slate-400 hover:border-indigo-200'}`}>
                    <span className="text-[11px] font-black">{opt.name}</span>
                    <span className="text-[8px] opacity-70 font-medium leading-tight">{opt.description}</span>
                  </button>
                ))
              ) : (
                CL_TEMPLATES.map(opt => (
                  <button key={opt.value} onClick={() => setClLayout(opt.value as any)} className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${clLayout === opt.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border-slate-50 text-slate-400 hover:border-indigo-200'}`}>
                    <span className="text-[12px] font-black uppercase tracking-wider">{opt.name} {opt.description}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          
          <div className="space-y-6 pt-6 border-t border-slate-50">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Font Selection</h2>
            <div className="grid grid-cols-2 gap-3">
               {FONT_OPTIONS.map(f => (
                 <button key={f.name} onClick={() => setActiveFont(f.value)} className={`py-4 rounded-xl border-2 transition-all text-[11px] font-black ${activeFont === f.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-50 text-slate-400 hover:border-indigo-100'}`} style={{ fontFamily: f.value }}>
                   {f.name}
                 </button>
               ))}
            </div>
          </div>
          <div className="space-y-10 pt-6 border-t border-slate-50">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Fine-tune View</h2>
            <div className="space-y-8 px-2">
              {[{ label: 'Margins', key: 'margin', unit: 'MM', min: 5, max: 40, step: 1 }, { label: 'Name Size', key: 'nameSize', unit: 'PT', min: 18, max: 60, step: 1 }, { label: 'Header Size', key: 'headerSize', unit: 'PT', min: 8, max: 18, step: 1 }, { label: 'Font Size', key: 'fontSize', unit: 'PT', min: 8, max: 14, step: 0.5 }, { label: 'Line Spacing', key: 'lineHeight', unit: '', min: 1.0, max: 2.0, step: 0.1 }].map(slider => (
                <div key={slider.key} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-prev-[10px] font-black text-slate-400 uppercase tracking-widest">{slider.label}</label>
                    <div className="bg-indigo-50 px-4 py-1.5 rounded-lg text-[10px] font-black text-indigo-600 flex items-center gap-1 min-w-[60px] justify-center"><span>{(currentSettings as any)[slider.key]}</span>{slider.unit && <span className="opacity-50 ml-1">{slider.unit}</span>}</div>
                  </div>
                  <input type="range" min={slider.min} max={slider.max} step={slider.step} value={(currentSettings as any)[slider.key]} onChange={(e) => updateSettings({ [slider.key]: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Improved Color Panel */}
          <div className="pt-6 border-t border-slate-50">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">Theme Color</h2>
            <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <div className="flex flex-wrap justify-center gap-3">
                    {/* Standard Colors */}
                    {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map(c => (
                        <button
                            key={c}
                            onClick={() => handleSetThemeColor(c)}
                            className={`w-9 h-9 rounded-full transition-all duration-300 relative flex items-center justify-center ${portfolioData.theme.color === c ? 'scale-110 shadow-lg ring-2 ring-offset-2 ring-indigo-100' : 'hover:scale-110 hover:shadow-md'}`}
                            style={{ backgroundColor: COLORS[c] }}
                        >
                            {portfolioData.theme.color === c && <span className="text-white text-xs">✓</span>}
                        </button>
                    ))}
                    {/* Custom Rainbow Picker */}
                    <div className={`relative w-9 h-9 rounded-full overflow-hidden transition-all duration-300 cursor-pointer group ${!COLORS[portfolioData.theme.color as keyof typeof COLORS] ? 'ring-2 ring-offset-2 ring-indigo-100 scale-110' : 'hover:scale-110'}`}>
                        <div className="absolute inset-0 bg-[conic-gradient(at_center,_red,_orange,_yellow,_green,_blue,_indigo,_violet)] opacity-80 group-hover:opacity-100 transition-opacity"></div>
                        <input
                            type="color"
                            value={currentThemeHex}
                            onChange={(e) => handleSetThemeColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {!COLORS[portfolioData.theme.color as keyof typeof COLORS] && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white text-xs drop-shadow-md">✓</div>
                        )}
                    </div>
                </div>
            </div>
          </div>
          
          <div className="space-y-6 pt-6 border-t border-slate-50">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Document Structure</h2>
             
             {/* Document Structure Controls */}
             <div className="flex flex-col gap-3">
                 <div className="flex gap-2">
                     <button onClick={handleAddPage} className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white hover:shadow-md transition-all">+ Add Page</button>
                     <button onClick={handleRemovePage} className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white hover:shadow-md transition-all">- Remove Page</button>
                 </div>
                 
                 {/* Portfolio Toggle / Add Button */}
                 {activeTab === 'resume' && (
                     <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${showPortfolio ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                             <span className="text-xs font-bold text-slate-600">Portfolio Highlights</span>
                         </div>
                         {portfolioData.projects.length > 0 ? (
                             <button 
                                onClick={() => setShowPortfolio(!showPortfolio)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${showPortfolio ? 'bg-white text-emerald-600 shadow-sm' : 'bg-slate-200 text-slate-500'}`}
                             >
                                 {showPortfolio ? 'ON' : 'OFF'}
                             </button>
                         ) : (
                             <button 
                                onClick={handleAddPortfolio}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-all"
                             >
                                 + Add
                             </button>
                         )}
                     </div>
                 )}
             </div>

             <p className="text-[10px] text-center text-slate-400">Pages: {activeTab === 'coverLetter' ? coverLetterPageCount : resumePageCount + (showPortfolio ? 1 : 0)}</p>
         </div>

          <div className="pt-8 space-y-3">
             <div className="flex gap-2 mb-2 justify-center">
                 <button onClick={handleUndo} disabled={history.length === 0} className="p-3 bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all font-bold text-xs" title="Undo (Ctrl+Z)">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                 </button>
                 <button onClick={handleRedo} disabled={future.length === 0} className="p-3 bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all font-bold text-xs" title="Redo (Ctrl+Shift+Z)">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                 </button>
             </div>
             <button onClick={() => setIsEditing(!isEditing)} className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${isEditing ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100' : 'bg-slate-900 text-white hover:bg-black shadow-lg'}`}>{isEditing ? 'Save Changes' : 'Edit Content'}</button>
             <button onClick={handleExportPDF} disabled={isExporting} className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">
               {isExporting ? 'Generating...' : 'Download PDF'}
             </button>
          </div>
         </div>
         <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
      </aside>

      <section className="flex-grow flex flex-col items-center bg-slate-50/50 px-16 py-12 overflow-auto custom-scrollbar relative">
        <div className="sticky top-0 z-50 mb-12 bg-white/90 backdrop-blur-md p-1.5 rounded-full border border-slate-200 shadow-sm flex gap-1 no-print">
           <button onClick={() => setActiveTab('resume')} className={`px-12 py-2.5 rounded-full text-[10px] font-black tracking-[0.2em] transition-all ${activeTab === 'resume' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-indigo-600'}`}>RESUME</button>
           <button onClick={() => setActiveTab('coverLetter')} className={`px-12 py-2.5 rounded-full text-[10px] font-black tracking-[0.2em] transition-all ${activeTab === 'coverLetter' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-indigo-600'}`}>COVER LETTER</button>
        </div>

        <div className="w-full flex justify-center pb-20" style={{ transform: isExporting ? 'none' : `scale(${zoom})`, transformOrigin: 'top center' }}>
           <div ref={previewRef} className="a4-desk">
              {activeTab === 'resume' ? (
                <>
                    {Array.from({ length: resumePageCount }).map((_, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-12 top-0 text-slate-300 font-black text-4xl opacity-50 select-none no-print">0{idx+1}</div>
                        
                        <div className="a4-page shadow-2xl">
                            {currentTemplate === 'Professional' ? <ProfessionalLayout pageIdx={idx} /> : 
                            currentTemplate === 'Creative' ? <CreativeLayout pageIdx={idx} /> :
                            currentTemplate === 'Academic' ? <AcademicLayout pageIdx={idx} /> :
                            currentTemplate === 'Grid' ? <GridLayout pageIdx={idx} /> :
                            <MinimalistLayout pageIdx={idx} />}
                        </div>

                        {resumePageCount > 1 && (
                            <div className="absolute top-4 right-4 z-50 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDeletePage(idx)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 hover:bg-rose-100 transition-colors shadow-sm"
                                    title="Remove this page"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    REMOVE PAGE
                                </button>
                            </div>
                        )}
                      </div>
                    ))}
                    {showPortfolio && (
                      <div className="relative group">
                          
                          <div className="a4-page shadow-2xl relative z-0">
                             <PortfolioLayout pageIdx={resumePageCount} />
                          </div>

                          {/* Allow deleting portfolio page */}
                          <div className="absolute top-6 right-6 z-[500] no-print opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleRemovePortfolio(e);
                                    }}
                                    className="cursor-pointer relative z-[500] flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black border border-rose-700 hover:bg-rose-700 shadow-md transform hover:scale-105 transition-all pointer-events-auto"
                                    title="Remove Portfolio Page"
                                    type="button"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    REMOVE PAGE
                                </button>
                          </div>
                      </div>
                    )}
                </>
              ) : (
                <>
                    {Array.from({ length: coverLetterPageCount }).map((_, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-12 top-0 text-slate-300 font-black text-4xl opacity-50 select-none no-print">0{idx+1}</div>
                        
                        <div className="a4-page shadow-2xl animate-fade-in">
                            <CoverLetterPreview pageIdx={idx} />
                        </div>

                        {coverLetterPageCount > 1 && (
                            <div className="absolute top-4 right-4 z-50 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDeletePage(idx)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 hover:bg-rose-100 transition-colors shadow-sm"
                                    title="Delete Page"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    REMOVE PAGE
                                </button>
                            </div>
                        )}
                      </div>
                    ))}
                </>
              )}
           </div>
        </div>
        
        <div className="fixed bottom-10 right-10 flex items-center bg-white border border-slate-200 p-2 rounded-2xl shadow-2xl gap-3 z-[100] no-print">
           <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="w-10 h-10 rounded-xl hover:bg-slate-50 font-black text-slate-500 transition-colors">-</button>
           <span className="text-[11px] font-black text-indigo-600 min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
           <button onClick={() => setZoom(z => Math.min(1.2, z + 0.1))} className="w-10 h-10 rounded-xl hover:bg-slate-50 font-black text-slate-500 transition-colors">+</button>
        </div>
      </section>

      {showHistoryPool && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 no-print animate-fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Experience Management</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Select from history or add a new role</p>
                 </div>
                 <button onClick={() => setShowHistoryPool(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all font-bold text-xl flex items-center justify-center shadow-sm">&times;</button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-slate-50/30">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">Add Custom Item</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <input type="text" placeholder="Role / Title" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={newItem.role} onChange={e => setNewItem({...newItem, role: e.target.value})} />
                          <input type="text" placeholder="Company / School" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={newItem.company} onChange={e => setNewItem({...newItem, company: e.target.value})} />
                          <input type="text" placeholder="Time (e.g. 2021 - Present)" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={newItem.period} onChange={e => setNewItem({...newItem, period: e.target.value})} />
                          <div className="flex items-center gap-4 px-1">
                              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="itemType" checked={newItem.type === 'work'} onChange={() => setNewItem({...newItem, type: 'work'})} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-600">Work</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="itemType" checked={newItem.type === 'project'} onChange={() => setNewItem({...newItem, type: 'project'})} className="w-4 h-4 text-amber-500 focus:ring-amber-500" /><span className="text-sm font-bold text-slate-600">School Project</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="itemType" checked={newItem.type === 'volunteer'} onChange={() => setNewItem({...newItem, type: 'volunteer'})} className="w-4 h-4 text-emerald-500 focus:ring-emerald-500" /><span className="text-sm font-bold text-slate-600">Volunteer</span></label>
                          </div>
                      </div>
                      <textarea placeholder="Description (Enter to separate bullets)" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 resize-none mb-4" rows={3} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
                      <button onClick={handleAddNewFromModal} disabled={!newItem.role} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">ADD NEW EXPERIENCE</button>
                  </div>

                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Experience Pool</h4>
                  <div className="space-y-3">
                     {[...(allOriginalExperiences || []), ...(allOriginalVolunteer || [])]
                        .filter(orig => !content.experiences?.some(curr => curr.id === orig.id) && !content.volunteer?.some(curr => curr.id === orig.id))
                        .map(exp => (
                        <div key={exp.id} className="group p-5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex justify-between items-center">
                           <div><h5 className="font-bold text-slate-900">{exp.role}</h5><p className="text-xs font-bold text-slate-400 uppercase">{exp.company} <span className="mx-1">•</span> {exp.period}</p><p className="text-xs text-slate-500 mt-2 line-clamp-1">{exp.bullets?.[0]}</p></div>
                           <div className="flex gap-2">
                               <button onClick={() => handleUpdateWithHistory({ ...content, experiences: [...(content.experiences || []), exp] })} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100">ADD WORK</button>
                               <button onClick={() => handleUpdateWithHistory({ ...content, schoolProjects: [...(content.schoolProjects || []), exp] })} className="px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100">ADD PROJ</button>
                               <button onClick={() => handleUpdateWithHistory({ ...content, volunteer: [...(content.volunteer || []), exp] })} className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100">ADD VOL</button>
                           </div>
                        </div>
                     ))}
                  </div>
              </div>
           </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .bullet-list-ul { list-style-type: none; padding-left: 0; margin-top: 8px; text-align: left; }
        .bullet-list-ul li { position: relative; padding-left: 1.5em; margin-bottom: 6px; text-align: left; }
        .bullet-list-ul li::before { content: "•"; position: absolute; left: 0.2em; color: ${currentThemeHex}; font-weight: 900; font-size: 1.2em; line-height: 1; top: 0.1em; }
        
        body.pdf-export-mode {
            background: white !important;
            overflow: visible !important;
            height: auto !important;
        }
        body.pdf-export-mode * {
            scrollbar-width: none !important; 
        }
        body.pdf-export-mode header,
        body.pdf-export-mode footer,
        body.pdf-export-mode aside,
        body.pdf-export-mode .no-print,
        body.pdf-export-mode .fixed {
            display: none !important;
        }
        body.pdf-export-mode #root,
        body.pdf-export-mode main,
        body.pdf-export-mode section.flex-grow {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            overflow: visible !important;
            display: block !important;
            height: auto !important;
            transform: none !important;
            position: static !important;
        }
        body.pdf-export-mode .a4-desk {
            padding: 0 !important;
            margin: 0 auto !important;
            gap: 0 !important;
            transform: none !important;
            width: 210mm !important;
            display: block !important;
            position: relative !important;
            left: auto !important;
            top: auto !important;
            box-shadow: none !important;
            background: white !important;
        }
        body.pdf-export-mode .a4-page {
            margin: 0 0 20px 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            height: 297mm !important;
            min-height: 297mm !important;
            overflow: hidden !important;
        }
        @media print { .no-print { display: none !important; } }
      `}} />
    </div>
  );
};
