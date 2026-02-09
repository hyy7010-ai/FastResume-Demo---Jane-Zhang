
import React, { useRef, useState, useEffect } from 'react';
import JSZip from "https://esm.sh/jszip@3.10.1";
import { PortfolioData, Project } from '../types';
import { generateDocumentSummary } from '../services/geminiService';

interface PortfolioGeneratorProps {
  portfolioData: PortfolioData;
  setPortfolioData: React.Dispatch<React.SetStateAction<PortfolioData>>;
  onGenerateProject: (fileInput: { mimeType: string; data: string; fileName: string }) => void;
  isLoading: boolean;
  onCancelLoading?: () => void;
}

const COLORS = {
  indigo: '#6366f1',
  blue: '#3b82f6',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  slate: '#334155',
  violet: '#8b5cf6',
};

const TEMPLATES = [
    { id: 'Minimalist', name: 'MINIMALIST', icon: 'M', desc: 'Clean / Brooklyn Style' },
    { id: 'Professional', name: 'PROFESSIONAL', icon: 'P', desc: 'Dark / Enver Style' },
    { id: 'Creative', name: 'CREATIVE', icon: 'C', desc: 'Bold / Gradient Style' },
    { id: 'Retro', name: 'RETRO', icon: 'R', desc: 'Vintage / Serif Style' },
    { id: 'Studio', name: 'STUDIO', icon: 'S', desc: 'Grid / Swiss Style' },
    { id: 'Pop', name: 'POP', icon: '✨', desc: 'Playful / Comic Style' },
];

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1200;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
        } else {
            resolve(event.target?.result as string);
        }
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

const Editable = ({ value, onChange, isEditing, className = "", tagName: Tag = 'div', multiline = false, placeholder = "Edit..." }: any) => {
    const [localValue, setLocalValue] = useState(value || '');
    
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    if (!isEditing) return <Tag className={className}>{value || ''}</Tag>;

    const commonClasses = `bg-white/90 text-[#1e293b] border-2 border-[var(--theme-primary-color)]/30 rounded-lg p-1 outline-none focus:border-[var(--theme-primary-color)] focus:ring-2 focus:ring-[var(--theme-primary-color)]/20 transition-all font-inherit z-50 relative shadow-sm pointer-events-auto min-w-[2em] inline-block`;

    if (multiline) {
        return (
            <textarea
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => onChange(localValue)}
                onClick={(e) => e.stopPropagation()}
                className={`${commonClasses} resize-none w-full ${className}`}
                placeholder={placeholder}
                rows={3}
                style={{ font: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit', color: '#1e293b' }}
            />
        );
    }

    return (
        <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue)}
            onClick={(e) => e.stopPropagation()}
            className={`${commonClasses} w-full ${className}`}
            placeholder={placeholder}
            style={{ font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: '#1e293b' }}
        />
    );
};

interface ProjectCardProps {
    project: Project;
    isEditing: boolean;
    activeTemplate: string;
    onUpdateProject: (id: string, field: keyof Project, val: any) => void;
    onMediaClick: (id: string) => void;
    onSetTarget: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, isEditing, activeTemplate, onUpdateProject, onMediaClick, onSetTarget }) => {
    const isPop = activeTemplate === 'Pop';
    const isRetro = activeTemplate === 'Retro';
    const isProfessional = activeTemplate === 'Professional';
    const hasLink = project.externalLink && project.externalLink.trim().length > 5;
    
    const platformName = React.useMemo(() => {
        if (project.socialPlatform === 'custom' && project.associatedSkills?.[0]) {
            return project.associatedSkills[0];
        }
        if (project.externalLink) {
            try {
                const hostname = new URL(project.externalLink).hostname;
                return hostname.replace('www.', '').split('.')[0].toUpperCase();
            } catch (e) {
                return 'LINK';
            }
        }
        return project.socialPlatform || 'VIEW';
    }, [project.socialPlatform, project.externalLink, project.associatedSkills]);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = `data:${project.originalMimeType};base64,${project.base64Data}`;
        link.download = project.originalFileName || `Project_${project.id}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderPreview = () => {
        if (project.originalMimeType.startsWith('image/')) {
            return <img src={`data:${project.originalMimeType};base64,${project.base64Data}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />;
        }
        if (project.originalMimeType.startsWith('video/')) {
            return (
                <div className="w-full h-full bg-black relative flex items-center justify-center">
                    <video src={`data:${project.originalMimeType};base64,${project.base64Data}`} className="w-full h-full object-cover opacity-80" muted loop autoPlay playsInline />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">▶</div>
                    </div>
                </div>
            );
        }
        if (project.originalMimeType.startsWith('audio/')) {
            return (
                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden group-hover:bg-slate-800 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-primary-color)]/20 to-purple-500/20"></div>
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                        <span className="text-3xl">🎵</span>
                    </div>
                    <div className="flex gap-1 items-end h-8">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="w-1.5 bg-[var(--theme-primary-color)] rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}></div>
                        ))}
                    </div>
                </div>
            );
        }
        const ext = project.originalFileName.split('.').pop()?.toUpperCase() || 'DOC';
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-6 border transition-colors relative overflow-hidden ${isProfessional ? 'bg-[#1e293b] border-white/5 group-hover:bg-[#253248]' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100'}`}>
                <div className={`w-14 h-20 rounded-lg shadow-sm flex flex-col items-center justify-center relative z-10 mb-4 ${isProfessional ? 'bg-white/10 text-white' : 'bg-white text-slate-500'}`}>
                    <span className="text-[8px] font-black">{ext}</span>
                    <div className="w-8 h-0.5 bg-current mt-1 opacity-30"></div>
                    <div className="w-6 h-0.5 bg-current mt-1 opacity-30"></div>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest truncate w-full text-center px-4 ${isProfessional ? 'text-slate-500' : 'text-slate-400'}`}>{project.originalFileName}</span>
            </div>
        );
    };

    return (
        <div 
            className={`group relative transition-all duration-500 h-full flex flex-col project-card-trigger ${isPop ? 'border-4 border-black shadow-[10px_10px_0_rgba(0,0,0,1)] bg-white p-6 rounded-xl' : isRetro ? 'bg-white/50 p-6 border-b-2 border-slate-200' : isProfessional ? 'bg-transparent' : 'bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-xl'}`}
            data-pid={project.id}
        >
            <div 
                className={`aspect-[4/3] overflow-hidden relative cursor-pointer mb-5 ${isPop ? 'border-2 border-black rounded-lg' : 'rounded-2xl border border-slate-100 shadow-inner'} ${isProfessional && project.type === 'Document' ? 'rounded-xl shadow-lg' : ''}`}
                onClick={() => isEditing ? onSetTarget(project.id) : onMediaClick(project.id)}
            >
                {project.base64Data ? renderPreview() : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                        {isEditing ? '+ Upload Content' : 'No Preview'}
                    </div>
                )}
                
                {hasLink && (
                    <div className="absolute top-3 left-3 z-20">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md shadow-sm border ${isProfessional ? 'bg-[var(--theme-primary-color)] border-[var(--theme-primary-color)] text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            <span className="text-[7px] font-black uppercase tracking-wider min-w-0">{platformName}</span>
                        </div>
                    </div>
                )}
                {isEditing && (
                    <div className="absolute inset-0 bg-[var(--theme-primary-color)]/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-white text-[var(--theme-primary-color)] text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-lg">Change Media</span>
                    </div>
                )}
            </div>

            {hasLink && (
                <div className="absolute top-2 right-2 z-50 transform rotate-6 group-hover:rotate-0 transition-transform duration-300 drop-shadow-xl hover:scale-105 origin-top-right">
                    <div className="bg-white p-1 pb-1.5 rounded-lg border-2 border-white shadow-sm flex flex-col items-center w-20">
                        <div className="w-full aspect-square bg-white flex items-center justify-center overflow-hidden rounded-md mb-1">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(project.externalLink || '')}`} alt="QR" className="w-full h-full mix-blend-multiply" />
                        </div>
                        <div className="bg-black w-full py-1 rounded-sm flex items-center justify-center">
                            <span className="text-[8px] font-black uppercase tracking-widest text-white leading-none">{platformName}</span>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="relative z-10">
                <Editable tagName="h4" className={`font-black text-xl uppercase tracking-tight mb-2 min-h-[1.2em] ${isProfessional ? 'text-white' : 'text-slate-900'}`} isEditing={isEditing} value={project.title} onChange={(v: string) => onUpdateProject(project.id, 'title', v)} />
                <div className="flex-grow">
                    <Editable tagName="p" multiline className={`text-sm leading-relaxed line-clamp-4 ${isProfessional ? 'text-slate-400' : 'text-slate-700'}`} isEditing={isEditing} value={project.description} onChange={(v: string) => onUpdateProject(project.id, 'description', v)} />
                </div>
            </div>

            <div className={`mt-4 pt-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity ${isProfessional ? 'border-t border-white/5' : 'border-t border-slate-100'}`}>
                <button onClick={() => onMediaClick(project.id)} className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-primary-color)] hover:underline">View Details →</button>
                <button onClick={handleDownload} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isProfessional ? 'bg-white/10 text-white hover:bg-white hover:text-slate-900' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900'}`} title="Download">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
            </div>

            {isEditing && (
                <div className="pt-5 border-t border-slate-100 flex flex-col gap-4 z-50 relative" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-3">
                        <input type="text" placeholder="Link (e.g. youtube.com/...)" className="w-full text-xs p-3 rounded-lg border-2 border-slate-100 focus:border-[var(--theme-primary-color)] outline-none bg-white text-slate-900 pointer-events-auto" value={project.externalLink || ''} onChange={(e) => onUpdateProject(project.id, 'externalLink', e.target.value)} onClick={e => e.stopPropagation()} />
                        {project.socialPlatform === 'custom' && (
                            <input type="text" placeholder="Label" className="w-20 text-[10px] p-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 font-bold pointer-events-auto" value={project.associatedSkills?.[0] || ''} onChange={(e) => onUpdateProject(project.id, 'associatedSkills', [e.target.value])} onClick={e => e.stopPropagation()} />
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {['tiktok', 'wechat', 'instagram', 'youtube', 'custom'].map(p => (
                            <button key={p} type="button" onClick={(e) => { e.stopPropagation(); onUpdateProject(project.id, 'socialPlatform', p); }} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${project.socialPlatform === p ? 'bg-[var(--theme-primary-color)] text-white border-[var(--theme-primary-color)]' : 'bg-white text-slate-400 border-slate-100'}`}>{p}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const getGroupedProjects = (projects: Project[]) => {
    return {
        creative: projects.filter(p => 
            p.category === 'Visual Design' || 
            p.category === 'Video Content' || 
            p.category === 'Visual' ||
            p.originalMimeType.startsWith('image/') || 
            p.originalMimeType.startsWith('video/')
        ),
        audio: projects.filter(p => 
            p.category === 'Audio Content' ||
            p.type === 'Audio' || 
            p.originalMimeType.startsWith('audio/')
        ),
        documents: projects.filter(p => 
            p.category === 'Marketing Strategy' || 
            p.category === 'Resource' || 
            p.category === 'Certificate' || 
            (p.type === 'Document' && p.category !== 'Audio Content')
        )
    };
};

const EditableSectionHeader = ({ 
    titleKey, subKey, defaultTitle, defaultSub, 
    customText, onUpdateText, isEditing, 
    colorClass = "text-slate-900" 
}: any) => (
    <div className={`flex items-end gap-4 mb-10 border-b border-current pb-4 opacity-80 ${colorClass}`}>
        <Editable 
            tagName="h3" 
            className="text-3xl font-black tracking-tight" 
            value={customText[titleKey] || defaultTitle} 
            isEditing={isEditing} 
            onChange={(v: string) => onUpdateText(titleKey, v)} 
        />
        <Editable 
            tagName="span" 
            className="text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-60" 
            value={customText[subKey] || defaultSub} 
            isEditing={isEditing} 
            onChange={(v: string) => onUpdateText(subKey, v)} 
        />
    </div>
);

interface TemplateProps {
    data: PortfolioData;
    isEditing: boolean;
    activeTemplate: string;
    onUpdateField: (field: string, val: string) => void;
    cardProps: Omit<ProjectCardProps, 'project'>;
    profilePhotoInputRef: React.RefObject<HTMLInputElement>;
    getProfileUrl: () => string;
    customText: any;
    onUpdateText: (key: string, val: string) => void;
}

const MinimalistTemplate: React.FC<TemplateProps> = ({ data, isEditing, onUpdateField, cardProps, profilePhotoInputRef, customText, onUpdateText }) => {
    const { creative, audio, documents } = getGroupedProjects(data.projects);
    return (
        <div className="max-w-6xl mx-auto py-24 px-8 font-['Inter']">
            <header className="mb-32 text-center">
                <div className="w-28 h-28 mx-auto rounded-full bg-slate-100 mb-10 overflow-hidden relative cursor-pointer group shadow-2xl" onClick={() => isEditing && profilePhotoInputRef.current?.click()}>
                    {data.userProfile.photo ? <img src={`data:image/jpeg;base64,${data.userProfile.photo}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-5xl">👤</div>}
                    {isEditing && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-widest">Update</div>}
                </div>
                <h1 className="text-8xl font-black tracking-tighter text-[#1e293b] mb-8">
                    <Editable tagName="span" isEditing={isEditing} value={data.jobPackage.resume?.fullName || "Your Name"} onChange={(v: string) => onUpdateField('fullName', v)} />
                </h1>
                <div className="h-1.5 w-24 bg-[var(--theme-primary-color)] mx-auto mb-10 rounded-full"></div>
                <Editable tagName="p" multiline className="max-w-3xl mx-auto text-2xl text-slate-700 font-medium leading-relaxed" isEditing={isEditing} value={data.userProfile.bio} onChange={(v: string) => onUpdateField('bio', v)} />
            </header>
            {creative.length > 0 && <section className="mb-24"><EditableSectionHeader titleKey="creativeTitle" subKey="creativeSub" defaultTitle="Visual Design" defaultSub="Selected Works" customText={customText} onUpdateText={onUpdateText} isEditing={isEditing} /><div className="grid grid-cols-1 md:grid-cols-2 gap-16">{creative.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
            {audio.length > 0 && <section className="mb-24"><EditableSectionHeader titleKey="audioTitle" subKey="audioSub" defaultTitle="Audio & Media" defaultSub="Soundscapes" customText={customText} onUpdateText={onUpdateText} isEditing={isEditing} /><div className="grid grid-cols-1 md:grid-cols-3 gap-10">{audio.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
            {documents.length > 0 && <section className="mb-24"><EditableSectionHeader titleKey="docsTitle" subKey="docsSub" defaultTitle="Marketing Strategy" defaultSub="Documents & Reports" customText={customText} onUpdateText={onUpdateText} isEditing={isEditing} /><div className="grid grid-cols-1 md:grid-cols-3 gap-10">{documents.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
        </div>
    );
};

const ProfessionalTemplate: React.FC<TemplateProps> = ({ data, isEditing, onUpdateField, cardProps, profilePhotoInputRef, customText, onUpdateText }) => {
    const { creative, audio, documents } = getGroupedProjects(data.projects);
    const resume = data.jobPackage.resume;
    const linkedin = resume?.linkedin || (resume?.contactInfo && resume.contactInfo.match(/linkedin\.com\/in\/[\w-]+/)?.[0]);
    const email = resume?.contactInfo && resume.contactInfo.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
    return (
        <div className="bg-[#0f172a] min-h-full text-white font-['Plus_Jakarta_Sans']">
            <div className="max-w-7xl mx-auto px-10 py-24">
                <header className="flex flex-col lg:flex-row items-center gap-20 mb-32 relative">
                    <div className="absolute top-0 right-0 flex gap-4 no-print">
                        {linkedin && <a href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all text-slate-400">LinkedIn</a>}
                        {email && <a href={`mailto:${email}`} className="px-4 py-2 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all text-slate-400">Email</a>}
                    </div>
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--theme-primary-color)]/10 border border-[var(--theme-primary-color)]/30 text-[var(--theme-primary-color)] mb-8">
                            <div className="w-2 h-2 rounded-full bg-[var(--theme-primary-color)] animate-pulse"></div>
                            <Editable tagName="span" className="text-[10px] font-black uppercase tracking-[0.2em]" isEditing={isEditing} value={customText.availabilityStatus || "Available for work"} onChange={(v: string) => onUpdateText('availabilityStatus', v)} />
                        </div>
                        <h1 className="text-7xl font-extrabold mb-8 leading-tight tracking-tight"><Editable tagName="span" isEditing={isEditing} value={data.jobPackage.resume?.fullName || "Your Name"} onChange={(v: string) => onUpdateField('fullName', v)} /></h1>
                        <div className="flex items-center gap-4 mb-10"><div className="w-16 h-1 bg-[var(--theme-primary-color)]"></div><h2 className="text-3xl text-slate-300 font-bold"><Editable tagName="span" isEditing={isEditing} value={data.userProfile.role} onChange={(v: string) => onUpdateField('role', v)} /></h2></div>
                        <Editable tagName="p" multiline className="text-slate-400 text-xl max-w-xl leading-loose" isEditing={isEditing} value={data.userProfile.bio} onChange={(v: string) => onUpdateField('bio', v)} />
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="w-80 h-80 rounded-[3rem] bg-slate-800 rotate-2 border-8 border-white/5 shadow-3xl overflow-hidden group relative cursor-pointer" onClick={() => isEditing && profilePhotoInputRef.current?.click()}>
                            {data.userProfile.photo ? <img src={`data:image/jpeg;base64,${data.userProfile.photo}`} className="w-full h-full object-cover transition-all grayscale group-hover:grayscale-0" /> : <div className="w-full h-full bg-slate-700 flex items-center justify-center text-4xl">💼</div>}
                            {isEditing && <div className="absolute inset-0 bg-black/70 flex items-center justify-center font-black text-xs uppercase tracking-widest">Update Visual</div>}
                        </div>
                    </div>
                </header>
                {creative.length > 0 && <section className="mb-20"><EditableSectionHeader titleKey="creativeTitle" subKey="creativeSub" defaultTitle="Visual Design" defaultSub="Selected Visuals" colorClass="text-white" customText={customText} onUpdateText={onUpdateText} isEditing={isEditing} /><div className="grid grid-cols-1 md:grid-cols-3 gap-10">{creative.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
                {audio.length > 0 && <section className="mb-20"><EditableSectionHeader titleKey="audioTitle" subKey="audioSub" defaultTitle="Audio Projects" defaultSub="Sonic Portfolio" colorClass="text-white" customText={customText} onUpdateText={onUpdateText} isEditing={isEditing} /><div className="grid grid-cols-1 md:grid-cols-3 gap-10">{audio.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
                {documents.length > 0 && <section><EditableSectionHeader titleKey="docsTitle" subKey="docsSub" defaultTitle="Marketing Strategy" defaultSub="Research & Reports" colorClass="text-white" customText={customText} onUpdateText={onUpdateText} isEditing={isEditing} /><div className="grid grid-cols-1 md:grid-cols-4 gap-8">{documents.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
                {data.projects.length === 0 && <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-[3rem]"><p className="text-slate-500 font-bold uppercase tracking-widest">Portfolio Empty. Upload files to begin.</p></div>}
            </div>
        </div>
    );
};

const CreativeTemplate: React.FC<TemplateProps> = ({ data, isEditing, onUpdateField, cardProps, customText, onUpdateText }) => {
    const { creative, audio, documents } = getGroupedProjects(data.projects);
    return (
        <div className="min-h-full bg-indigo-50 font-['Inter']">
            <div className="h-[90vh] bg-gradient-to-br from-[var(--theme-primary-color)] to-purple-900 text-white p-12 md:p-24 flex flex-col justify-end relative overflow-hidden">
                <div className="absolute top-10 right-10 text-[20rem] font-black opacity-5 select-none tracking-tighter pointer-events-none">PORTFOLIO</div>
                <div className="max-w-5xl relative z-10">
                    <h1 className="text-[10rem] font-black leading-[0.8] mb-10 tracking-tighter"><Editable tagName="span" isEditing={isEditing} value={data.jobPackage.resume?.fullName || "Your Name"} onChange={(v: string) => onUpdateField('fullName', v)} />.</h1>
                    <Editable tagName="p" multiline className="text-4xl font-light text-white/90 max-w-3xl leading-snug" isEditing={isEditing} value={data.userProfile.bio} onChange={(v: string) => onUpdateField('bio', v)} />
                </div>
            </div>
            <div className="max-w-7xl mx-auto p-12 -mt-32 relative z-20">
                {creative.length > 0 && <section className="mb-24"><Editable tagName="h3" className="text-white text-4xl font-black mb-12 uppercase tracking-tighter" value={customText.creativeTitle || "Visual Design"} isEditing={isEditing} onChange={(v: string) => onUpdateText('creativeTitle', v)} /><div className="grid grid-cols-1 md:grid-cols-2 gap-12">{creative.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
                {audio.length > 0 && <section className="mb-24 bg-black p-12 rounded-[3rem] shadow-2xl"><Editable tagName="h3" className="text-white text-4xl font-black mb-12 uppercase tracking-tighter" value={customText.audioTitle || "Audio"} isEditing={isEditing} onChange={(v: string) => onUpdateText('audioTitle', v)} /><div className="grid grid-cols-1 md:grid-cols-2 gap-12">{audio.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
                {documents.length > 0 && <section className="mb-24"><Editable tagName="h3" className="text-slate-900 text-4xl font-black mb-12 uppercase tracking-tighter" value={customText.docsTitle || "Marketing Strategy"} isEditing={isEditing} onChange={(v: string) => onUpdateText('docsTitle', v)} /><div className="grid grid-cols-1 md:grid-cols-3 gap-12">{documents.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></section>}
            </div>
        </div>
    );
};

const RetroTemplate: React.FC<TemplateProps> = ({ data, isEditing, onUpdateField, cardProps, profilePhotoInputRef, customText, onUpdateText }) => {
    const { creative, audio, documents } = getGroupedProjects(data.projects);
    return (
        <div className="bg-[#fcfaf4] min-h-full font-['Lora','Playfair_Display'] text-[#1a1a1a] p-10 md:p-20">
            <nav className="flex justify-between border-b-4 border-black pb-10 mb-20 items-end">
                <div><Editable tagName="span" className="font-black text-3xl uppercase tracking-tighter" value={customText.retroBrand || "Archive Vol. 25"} isEditing={isEditing} onChange={(v: string) => onUpdateText('retroBrand', v)} /><Editable tagName="p" className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest" value={customText.retroSub || "Selective Works Portfolio"} isEditing={isEditing} onChange={(v: string) => onUpdateText('retroSub', v)} /></div>
                <span className="font-medium text-4xl italic tracking-tight">{data.jobPackage.resume?.fullName || "Your Name"}</span>
            </nav>
            <header className="grid grid-cols-1 lg:grid-cols-2 gap-24 mb-32 items-center">
                <div><Editable tagName="h1" multiline className="text-[9rem] font-black uppercase leading-[0.75] mb-12 tracking-tighter" value={customText.retroHero || "True \nCraft."} isEditing={isEditing} onChange={(v: string) => onUpdateText('retroHero', v)} /><Editable tagName="p" multiline className="text-3xl font-serif leading-relaxed italic text-slate-700" isEditing={isEditing} value={data.userProfile.bio} onChange={(v: string) => onUpdateField('bio', v)} /></div>
                <div className="aspect-[4/5] bg-slate-200 border-[16px] border-white shadow-2xl relative cursor-pointer transform -rotate-1 hover:rotate-0 transition-transform duration-500 group" onClick={() => isEditing && profilePhotoInputRef.current?.click()}>{data.userProfile.photo ? <img src={`data:image/jpeg;base64,${data.userProfile.photo}`} className="w-full h-full object-cover sepia-[0.2]" /> : <div className="w-full h-full flex items-center justify-center text-6xl">🎞️</div>}{isEditing && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-black uppercase text-[10px] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Swap Image</div>}</div>
            </header>
            {creative.length > 0 && <div className="mb-20"><Editable tagName="h3" className="text-4xl font-serif italic mb-8 border-b-2 border-black inline-block" value={customText.retroVisuals || "Visual Archives"} isEditing={isEditing} onChange={(v: string) => onUpdateText('retroVisuals', v)} /><div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border-2 border-slate-200">{creative.map(p => <div key={p.id} className="bg-[#fcfaf4]"><ProjectCard project={p} {...cardProps} /></div>)}</div></div>}
            {audio.length > 0 && <div className="mb-20"><Editable tagName="h3" className="text-4xl font-serif italic mb-8 border-b-2 border-black inline-block" value={customText.retroAudio || "Audio Records"} isEditing={isEditing} onChange={(v: string) => onUpdateText('retroAudio', v)} /><div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border-2 border-slate-200">{audio.map(p => <div key={p.id} className="bg-[#fcfaf4]"><ProjectCard project={p} {...cardProps} /></div>)}</div></div>}
            {documents.length > 0 && <div className="mb-20"><Editable tagName="h3" className="text-4xl font-serif italic mb-8 border-b-2 border-black inline-block" value={customText.retroDocs || "Manuscripts"} isEditing={isEditing} onChange={(v: string) => onUpdateText('retroDocs', v)} /><div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 border-2 border-slate-200">{documents.map(p => <div key={p.id} className="bg-[#fcfaf4]"><ProjectCard project={p} {...cardProps} /></div>)}</div></div>}
        </div>
    );
};

const StudioTemplate: React.FC<TemplateProps> = ({ data, isEditing, onUpdateField, cardProps, profilePhotoInputRef, customText, onUpdateText }) => {
    const { creative, audio, documents } = getGroupedProjects(data.projects);
    return (
        <div className="bg-white min-h-full font-['Inter'] text-black p-6">
            <div className="grid grid-cols-12 gap-px bg-black border border-black shadow-2xl">
                <div className="col-span-12 md:col-span-8 bg-white p-16">
                    <h1 className="text-[11rem] font-black tracking-tighter uppercase leading-[0.75] mb-16"><Editable tagName="span" isEditing={isEditing} value={data.jobPackage.resume?.fullName.split(' ')[0] || "Name"} onChange={(v: string) => onUpdateField('fullName', v)} /></h1>
                    <div className="grid grid-cols-2 gap-16">
                        <div><h4 className="text-[10px] font-black uppercase mb-4 text-[var(--theme-primary-color)]"><Editable tagName="span" value={customText.manifestoTitle || "Manifesto"} isEditing={isEditing} onChange={(v: string) => onUpdateText('manifestoTitle', v)} /></h4><Editable tagName="p" multiline className="text-base font-bold uppercase tracking-widest leading-loose" isEditing={isEditing} value={data.userProfile.bio} onChange={(v: string) => onUpdateField('bio', v)} /></div>
                        <div className="text-[11px] font-black uppercase space-y-2 border-l border-black pl-8">
                            <div className="flex gap-2 items-center">
                                <span className="opacity-70">Location:</span> 
                                <Editable tagName="span" isEditing={isEditing} value={data.userProfile.country || 'Global'} onChange={(v: string) => onUpdateField('country', v)} />
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="opacity-70">Role:</span>
                                <Editable tagName="span" isEditing={isEditing} value={data.userProfile.role} onChange={(v: string) => onUpdateField('role', v)} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-span-12 md:col-span-4 bg-[var(--theme-primary-color)] p-12 flex items-center justify-center cursor-pointer relative overflow-hidden group" onClick={() => isEditing && profilePhotoInputRef.current?.click()}>
                    {data.userProfile.photo ? <img src={`data:image/jpeg;base64,${data.userProfile.photo}`} className="w-full h-full object-cover mix-blend-multiply grayscale hover:grayscale-0 transition-all duration-500" /> : <div className="text-9xl font-black text-white/30 tracking-tighter rotate-90">GALLERY</div>}
                    {isEditing && <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Change</div>}
                </div>
                
                {creative.length > 0 && <div className="col-span-12 bg-black p-4 text-white font-black uppercase tracking-[0.5em] text-center text-xs"><Editable tagName="span" value={customText.creativeTitle || "Visual Design"} isEditing={isEditing} onChange={(v: string) => onUpdateText('creativeTitle', v)} className="bg-black text-white" /></div>}
                {creative.map(p => <div key={p.id} className="col-span-12 md:col-span-4 bg-white p-px"><ProjectCard project={p} {...cardProps} /></div>)}
                
                {audio.length > 0 && <div className="col-span-12 bg-black p-4 text-white font-black uppercase tracking-[0.5em] text-center text-xs"><Editable tagName="span" value={customText.audioTitle || "Audio"} isEditing={isEditing} onChange={(v: string) => onUpdateText('audioTitle', v)} className="bg-black text-white" /></div>}
                {audio.map(p => <div key={p.id} className="col-span-12 md:col-span-4 bg-white p-px"><ProjectCard project={p} {...cardProps} /></div>)}

                {documents.length > 0 && <div className="col-span-12 bg-black p-4 text-white font-black uppercase tracking-[0.5em] text-center text-xs"><Editable tagName="span" value={customText.docsTitle || "Marketing Strategy"} isEditing={isEditing} onChange={(v: string) => onUpdateText('docsTitle', v)} className="bg-black text-white" /></div>}
                {documents.map(p => <div key={p.id} className="col-span-12 md:col-span-4 bg-white p-px"><ProjectCard project={p} {...cardProps} /></div>)}
            </div>
        </div>
    );
};

const PopTemplate: React.FC<TemplateProps> = ({ data, isEditing, onUpdateField, cardProps, customText, onUpdateText }) => {
    const { creative, audio, documents } = getGroupedProjects(data.projects);
    return (
        <div className="bg-amber-300 min-h-full p-10 md:p-20 font-['Plus_Jakarta_Sans']">
            <div className="bg-white border-[10px] border-black rounded-[4rem] p-16 shadow-[30px_30px_0_rgba(0,0,0,1)] relative overflow-hidden">
                <header className="mb-24 text-center">
                    <h1 className="text-[9rem] font-black uppercase tracking-tighter mb-6 transform -rotate-1 drop-shadow-lg"><Editable tagName="span" isEditing={isEditing} value={data.jobPackage.resume?.fullName.split(' ')[0] || "Name"} onChange={(v: string) => onUpdateField('fullName', v)} /></h1>
                    <div className="inline-block bg-[var(--theme-primary-color)] text-white px-10 py-4 rounded-full border-[6px] border-black text-3xl font-black uppercase mb-10 shadow-[8px_8px_0_rgba(0,0,0,1)]"><Editable tagName="span" isEditing={isEditing} value={data.userProfile.role} onChange={(v: string) => onUpdateField('role', v)} /></div>
                    <Editable tagName="p" multiline className="text-4xl font-extrabold leading-tight max-w-4xl text-slate-900 mx-auto" isEditing={isEditing} value={data.userProfile.bio} onChange={(v: string) => onUpdateField('bio', v)} />
                </header>
                {creative.length > 0 && <div className="mb-24"><div className="text-3xl font-black uppercase border-b-4 border-black inline-block mb-10 transform -rotate-1 bg-rose-400 text-white px-4 py-1"><Editable tagName="span" value={customText.popVisuals || "Visual Design"} isEditing={isEditing} onChange={(v: string) => onUpdateText('popVisuals', v)} className="bg-rose-400 text-white" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-16">{creative.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></div>}
                {audio.length > 0 && <div className="mb-24"><div className="text-3xl font-black uppercase border-b-4 border-black inline-block mb-10 transform rotate-1 bg-indigo-400 text-white px-4 py-1"><Editable tagName="span" value={customText.popAudio || "Audio Content"} isEditing={isEditing} onChange={(v: string) => onUpdateText('popAudio', v)} className="bg-indigo-400 text-white" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-16">{audio.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></div>}
                {documents.length > 0 && <div className="mb-24"><div className="text-3xl font-black uppercase border-b-4 border-black inline-block mb-10 transform -rotate-1 bg-emerald-400 text-white px-4 py-1"><Editable tagName="span" value={customText.popDocs || "Marketing Strategy"} isEditing={isEditing} onChange={(v: string) => onUpdateText('popDocs', v)} className="bg-emerald-400 text-white" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-16">{documents.map(p => <ProjectCard key={p.id} project={p} {...cardProps} />)}</div></div>}
            </div>
        </div>
    );
};

const ProjectViewerModal = ({ project, onClose }: { project: Project, onClose: () => void }) => {
    const [aiSummary, setAiSummary] = useState<{ summary: string; keyPoints: string[] } | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState(false);

    const triggerAnalysis = () => {
        setAnalyzing(true);
        setAnalyzeError(false);
        generateDocumentSummary(project.base64Data, project.originalMimeType)
            .then(res => {
                if (res.summary === "Analysis failed" || res.summary.includes("Could not analyze")) {
                    setAnalyzeError(true);
                } else {
                    setAiSummary(res);
                }
                setAnalyzing(false);
            })
            .catch(() => {
                setAnalyzeError(true);
                setAnalyzing(false);
            });
    };

    useEffect(() => {
        const isDoc = project.type === 'Document' || project.originalMimeType.includes('pdf') || project.originalMimeType.includes('word') || project.originalMimeType.includes('text');
        if (isDoc && !aiSummary && !analyzing) {
            triggerAnalysis();
        }
    }, [project]);

    const isVisual = project.originalMimeType.startsWith('image/');
    const isVideo = project.originalMimeType.startsWith('video/');
    const isAudio = project.originalMimeType.startsWith('audio/');
    
    return (
        <div className="fixed inset-0 z-[1000] bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fade-in" onClick={onClose}>
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative border border-white/50" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 z-50 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all font-bold">✕</button>
                <div className="md:w-1/2 bg-slate-50 flex flex-col items-center justify-center p-12 relative border-r border-slate-100">
                    {isVisual ? (
                        <img src={`data:${project.originalMimeType};base64,${project.base64Data}`} className="max-h-full max-w-full object-contain relative z-10 shadow-lg rounded-lg" />
                    ) : isVideo ? (
                        <video src={`data:${project.originalMimeType};base64,${project.base64Data}`} className="max-h-full max-w-full object-contain relative z-10 shadow-lg rounded-lg" controls autoPlay />
                    ) : isAudio ? (
                        <div className="flex flex-col items-center justify-center w-full max-w-md p-10 bg-white rounded-[2rem] shadow-xl border border-slate-100 relative z-10">
                            <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6 text-white text-3xl shadow-lg">▶</div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="w-1/3 h-full bg-slate-900 rounded-full"></div>
                            </div>
                            <div className="flex justify-between w-full mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>0:00</span><span>Audio Content</span>
                            </div>
                            <audio src={`data:${project.originalMimeType};base64,${project.base64Data}`} className="hidden" />
                        </div>
                    ) : (
                        <div className="aspect-[3/4] h-3/4 bg-white rounded-lg shadow-xl flex flex-col items-center justify-center p-8 border border-slate-100 relative group z-10">
                            <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 text-slate-300 group-hover:scale-110 transition-transform duration-500">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg text-center leading-tight mb-2 max-w-[200px] truncate">{project.originalFileName}</h3>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PREVIEW UNAVAILABLE</span>
                        </div>
                    )}
                    <div className="mt-8 flex gap-3">
                         <a 
                            href={`data:${project.originalMimeType};base64,${project.base64Data}`} 
                            download={project.originalFileName}
                            className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download
                        </a>
                        {project.externalLink && (
                            <a href={project.externalLink} target="_blank" rel="noreferrer" className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2">
                                Open Link
                            </a>
                        )}
                    </div>
                </div>
                <div className="md:w-1/2 p-12 bg-white flex flex-col relative z-20 h-full">
                    <div className="flex-grow overflow-y-auto custom-scrollbar pr-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-md text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-8">
                            {project.category || 'Portfolio Item'}
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-8 leading-[1.1] tracking-tight">{project.title}</h2>
                        {analyzing ? (
                            <div className="animate-pulse space-y-4">
                                <div className="h-4 bg-slate-100 rounded w-full"></div>
                                <div className="h-4 bg-slate-100 rounded w-full"></div>
                                <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                                <span className="text-xs font-bold text-indigo-600 mt-2 block animate-bounce">AI Intelligence Analyzing...</span>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Description / Executive Summary</h4>
                                    <div className="prose prose-slate max-w-none">
                                        <p className="text-base lg:text-lg font-medium text-slate-600 leading-loose">
                                            {aiSummary?.summary || project.description}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Key Competencies</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(aiSummary?.keyPoints || project.associatedSkills || []).map((kp, i) => (
                                            <span key={i} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-bold text-slate-700">{kp}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PortfolioGenerator: React.FC<PortfolioGeneratorProps> = ({ 
  portfolioData, 
  setPortfolioData, 
  onGenerateProject,
  isLoading,
  onCancelLoading 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null); 
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const readingReader = useRef<FileReader | null>(null);
  const previewContentRef = useRef<HTMLDivElement>(null); 
  
  const [activeTemplate, setActiveTemplate] = useState('Professional'); 
  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hostedUrl, setHostedUrl] = useState('');
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  const handleUpdateText = (key: string, val: string) => {
      setCustomText(prev => ({ ...prev, [key]: val }));
  };

  const getProfileUrl = () => {
    const name = portfolioData.jobPackage.resume?.fullName || "User";
    return `https://fastresume.ai/u/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  };

  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('Initializing...');

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setUploadProgress(0);
      const messages = ["Analyzing Media Type...", "Generating Description...", "AI Neural Analysis...", "Writing Executive Summary...", "Almost there..."];
      let msgIdx = 0;
      setProgressMsg(messages[0]);
      
      interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 98) return prev;
          const inc = Math.random() * 15 + 5;
          if (prev > 15 && msgIdx === 0) { msgIdx=1; setProgressMsg(messages[1]); }
          if (prev > 40 && msgIdx === 1) { msgIdx=2; setProgressMsg(messages[2]); }
          if (prev > 65 && msgIdx === 2) { msgIdx=3; setProgressMsg(messages[3]); }
          if (prev > 88 && msgIdx === 3) { msgIdx=4; setProgressMsg(messages[4]); }
          return Math.min(prev + inc, 98);
        });
      }, 40);
    } else {
      setUploadProgress(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const themeColor = (COLORS as any)[portfolioData.theme.color] || portfolioData.theme.color || COLORS.indigo;

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-primary-color', themeColor);
  }, [themeColor]);

  const handleClearAll = () => {
    if (window.confirm('This will wipe all projects, your bio, and your photo. Are you sure?')) {
        setPortfolioData({
            userProfile: { country: 'AU', role: 'Student', photo: null, bio: '' },
            theme: { color: 'indigo', template: 'Professional' }, 
            projects: [],
            healthScore: 0,
            jobPackage: { resume: null, coverLetter: null },
        });
        setIsEditing(false);
        if (onCancelLoading) onCancelLoading(); 
    }
  };
  
  const handleCancelOperation = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isReadingFile && readingReader.current) {
          readingReader.current.abort();
          setIsReadingFile(false);
          setFileProgress(0);
          return;
      }
      if (isLoading && onCancelLoading) {
          onCancelLoading();
      }
  };

  const updateField = (field: string, val: string) => {
      setPortfolioData(prev => {
          if (field === 'fullName') {
              const currentResume = prev.jobPackage.resume || {
                  fullName: '', contactInfo: '', linkedin: '', github: '', website: '',
                  summary: '', targetJobTitle: '', targetCompany: '', targetAddress: '',
                  recipientName: '', technicalSkills: [], softSkills: [],
                  experiences: [], volunteer: [], schoolProjects: [], education: [], references: []
              };
              return { ...prev, jobPackage: { ...prev.jobPackage, resume: { ...currentResume, fullName: val } } };
          } else if (field === 'role' || field === 'bio' || field === 'country') {
              return { ...prev, userProfile: { ...prev.userProfile, [field]: val } };
          }
          return prev;
      });
  };

  const handleUpdateProject = async (id: string, field: keyof Project, value: any) => {
      setPortfolioData(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === id ? { ...p, [field]: value } : p)
      }));
  };

  const processFiles = async (files: FileList | File[]) => {
      setIsReadingFile(true);
      const fileList = Array.from(files);
      const totalFiles = fileList.length;

      for (let i = 0; i < totalFiles; i++) {
          const file = fileList[i];
          setFileProgress(0);
          
          try {
              let resultData = "";
              let mimeType = file.type;

              if (file.type.startsWith('image/')) {
                  setFileProgress(20);
                  resultData = await compressImage(file);
                  mimeType = 'image/jpeg';
                  setFileProgress(100);
              } else {
                  await new Promise<void>((resolve, reject) => {
                      const reader = new FileReader();
                      readingReader.current = reader;
                      reader.onprogress = (ev) => { if (ev.lengthComputable) setFileProgress(Math.round((ev.loaded / ev.total) * 100)); };
                      reader.onload = (ev) => { resultData = (ev.target?.result as string).split(',')[1]; resolve(); };
                      reader.onerror = reject;
                      reader.onabort = reject;
                      reader.readAsDataURL(file);
                  });
              }

              onGenerateProject({ mimeType: mimeType || 'application/octet-stream', data: resultData, fileName: file.name });
              await new Promise(r => setTimeout(r, 100));
          } catch (e) {
              console.error("File read error", e);
          }
      }
      setIsReadingFile(false);
      setFileProgress(0);
      readingReader.current = null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
      e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const compressedData = await compressImage(file);
              setPortfolioData(prev => ({ ...prev, userProfile: { ...prev.userProfile, photo: compressedData } }));
          } catch(e) { console.error(e); }
      }
      e.target.value = '';
  };

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && targetProjectId) {
          try {
              const compressedData = await compressImage(file);
              handleUpdateProject(targetProjectId, 'base64Data', compressedData);
          } catch(e) { console.error(e); }
      }
      e.target.value = '';
  };

  const getCleanHtml = () => {
      if (!previewContentRef.current) return '';
      const content = previewContentRef.current.innerHTML;
      const themeColorVar = document.documentElement.style.getPropertyValue('--theme-primary-color') || COLORS.indigo;
      const projectsJson = JSON.stringify(portfolioData.projects);
      
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${portfolioData.jobPackage.resume?.fullName || 'Portfolio'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700&family=Inter:wght@400;700;900&family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">
    <style>
        :root { --theme-primary-color: ${themeColorVar}; }
        * { box-sizing: border-box; }
        body { margin: 0; background-color: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif; }
        html, body { height: 100%; overflow-x: hidden; }
        img { max-width: 100%; height: auto; }
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(5px);
            z-index: 1000; display: none; opacity: 0; transition: opacity 0.3s;
            align-items: center; justify-content: center;
        }
        .modal-overlay.active { display: flex; opacity: 1; }
        .modal-content {
            background: #ffffff; width: 95%; max-width: 1300px; height: 90vh;
            border-radius: 1.5rem; overflow: hidden; display: flex;
            box-shadow: 0 40px 80px -12px rgba(0, 0, 0, 0.08); border: 1px solid #f1f5f9;
            flex-direction: column; position: relative;
        }
        @media (min-width: 768px) { .modal-content { flex-direction: row; } #modal-media { width: 58.333%; } #modal-info { width: 41.666%; } }
        .close-btn {
            position: absolute; top: 2rem; right: 2rem; z-index: 50;
            width: 3rem; height: 3rem; background: #f8fafc; border-radius: 50%;
            display: flex; items-center; justify-content: center;
            font-weight: bold; cursor: pointer; color: #64748b; transition: all 0.2s;
        }
        #modal-info { padding: 3rem; padding-top: 5rem; position: relative; }
    </style>
</head>
<body>
    <div id="root-content">${content}</div>
    <div id="project-modal" class="modal-overlay"><div class="modal-content relative"><button class="close-btn" onclick="closeModal()">✕</button><div id="modal-media" class="w-full md:w-7/12 bg-white flex items-center justify-center p-10 overflow-hidden relative border-r border-slate-50"></div><div id="modal-info" class="w-full md:w-5/12 bg-white flex flex-col justify-center overflow-y-auto"></div></div></div>
    <script>
        const PROJECTS = ${projectsJson};
        function closeModal() { document.getElementById('project-modal').classList.remove('active'); }
        document.addEventListener('DOMContentLoaded', () => {
            const triggers = document.querySelectorAll('.project-card-trigger');
            triggers.forEach(card => {
                card.addEventListener('click', (e) => {
                    const pid = card.getAttribute('data-pid');
                    const project = PROJECTS.find(p => p.id === pid);
                    if(project) openProject(project);
                });
            });
        });
        function openProject(p) {
            const modal = document.getElementById('project-modal');
            const mediaContainer = document.getElementById('modal-media');
            const infoContainer = document.getElementById('modal-info');
            let mediaHtml = '';
            if(p.originalMimeType.startsWith('image/')) mediaHtml = '<img src="data:' + p.originalMimeType + ';base64,' + p.base64Data + '" class="max-h-full max-w-full object-contain rounded-lg shadow-sm" />';
            else if(p.originalMimeType.startsWith('video/')) mediaHtml = '<video src="data:' + p.originalMimeType + ';base64,' + p.base64Data + '" controls autoplay class="max-h-full max-w-full rounded-lg shadow-sm"></video>';
            else mediaHtml = '<div class="text-center"><div class="text-6xl mb-4 text-slate-300">📄</div><p class="font-bold text-slate-400">Document Preview</p></div>';
            mediaContainer.innerHTML = mediaHtml;
            infoContainer.innerHTML = \`<div class="mb-auto"><span class="inline-block px-3 py-1 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest mb-8">\${p.category || p.type}</span><h2 class="text-4xl font-black text-slate-900 mb-6 leading-tight">\${p.title}</h2><p class="text-base text-slate-500 leading-loose font-medium">\${p.description}</p></div><div class="mt-8 pt-8 border-t border-slate-50">\${p.base64Data ? \`<a href="data:\${p.originalMimeType};base64,\${p.base64Data}" download="\${p.originalFileName}" class="inline-flex items-center justify-center w-full py-4 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors">Download Original</a>\` : ''}\${p.externalLink ? \`<a href="\${p.externalLink}" target="_blank" class="mt-3 inline-flex items-center justify-center w-full py-4 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-slate-300 hover:text-slate-900 transition-colors">Open Live Link</a>\` : ''}</div>\`;
            modal.classList.add('active');
        }
    </script>
</body>
</html>`;
  };

  const handleDownloadWebsite = async (forNetlify = false) => {
      const htmlContent = getCleanHtml();
      try {
        const zip = new JSZip();
        zip.file("index.html", htmlContent);
        zip.file("_redirects", "/* /index.html 200"); 
        zip.file("README.txt", "1. Go to https://app.netlify.com/drop\\n2. Drag this ZIP file into the upload area.\\n3. Your site will be online instantly.");
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = forNetlify ? `NETLIFY_BUNDLE_${portfolioData.jobPackage.resume?.fullName.replace(/\\s+/g, '_') || 'User'}.zip` : `Portfolio_${portfolioData.jobPackage.resume?.fullName.replace(/\\s+/g, '_') || 'User'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) { console.error("Zip failed", e); }
  };

  const handleLocalPreview = async () => {
      setIsPublishing(true);
      try {
          const htmlContent = getCleanHtml();
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const newWindow = window.open(url, '_blank');
          if (!newWindow) alert("Popup blocked!");
          setHostedUrl(url); 
          setTimeout(() => setHostedUrl(''), 5000);
      } catch (e) { console.error("Preview failed", e); }
      finally { setIsPublishing(false); }
  };

  const templateProps: TemplateProps = {
      data: portfolioData, isEditing, activeTemplate, onUpdateField: updateField,
      profilePhotoInputRef, getProfileUrl, customText, onUpdateText: handleUpdateText,
      cardProps: {
          isEditing, activeTemplate, onUpdateProject: handleUpdateProject,
          onMediaClick: (id: string) => setActiveModalId(id),
          onSetTarget: (id: string) => { setTargetProjectId(id); coverInputRef.current?.click(); }
      }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-white">
      <aside className="w-[360px] min-w-[360px] bg-white border-r border-slate-200 z-[60] flex flex-col h-full shrink-0 relative shadow-xl">
          <div className="flex-grow overflow-y-auto custom-scrollbar p-8">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Design System</h2>
                  <button onClick={() => setShowShareModal(true)} className="text-[10px] font-black uppercase text-[var(--theme-primary-color)] hover:underline flex items-center gap-1.5 px-3 py-1.5 bg-[var(--theme-primary-color)]/10 rounded-lg transition-all">
                    SHARE <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </button>
              </div>

              <div className="grid grid-cols-2 gap-3.5 mb-10">
                  {TEMPLATES.map(t => (
                      <button 
                        key={t.id} onClick={() => setActiveTemplate(t.id)}
                        className={`p-5 rounded-2xl border-2 text-left transition-all group flex flex-col min-w-0 ${activeTemplate === t.id ? 'border-[var(--theme-primary-color)] bg-[var(--theme-primary-color)]/10 text-[var(--theme-primary-color)] shadow-xl' : 'border-slate-50 hover:border-slate-200 text-slate-400'}`}
                      >
                          <span className="block text-3xl font-black mb-1.5 group-hover:scale-110 transition-transform duration-300">{t.icon}</span>
                          <span className="text-[11px] font-black uppercase mb-1 truncate">{t.name}</span>
                          <span className="block text-[8px] opacity-60 font-medium truncate">{t.desc}</span>
                      </button>
                  ))}
              </div>

              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Theme Accent</h2>
              <div className="flex flex-wrap gap-4 mb-10">
                  {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map(c => (
                      <button 
                        key={c} onClick={() => setPortfolioData(prev => ({ ...prev, theme: { ...prev.theme, color: c } }))}
                        className={`w-11 h-11 rounded-full transition-all hover:scale-110 shadow-lg relative ${portfolioData.theme.color === c ? 'ring-4 ring-[var(--theme-primary-color)]/30 ring-offset-2 scale-110' : ''}`}
                        style={{ backgroundColor: COLORS[c] }}
                      >
                         {portfolioData.theme.color === c && <div className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">✓</div>}
                      </button>
                  ))}
              </div>

              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.25em] transition-all mb-10 shadow-2xl ${isEditing ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-black'}`}
              >
                {isEditing ? '✓ Save Changes' : 'Edit Content'}
              </button>

              <div className="pt-10 border-t border-slate-100">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Inventory</h3>
                   <div className="space-y-4">
                        <div 
                          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                          className={`relative rounded-3xl transition-all duration-300 ${isDragging ? 'p-2 bg-indigo-50 ring-4 ring-indigo-200 shadow-2xl scale-[1.02]' : ''}`}
                        >
                            <button 
                              onClick={() => !isLoading && !isReadingFile && fileInputRef.current?.click()} 
                              disabled={isLoading || isReadingFile}
                              className={`w-full p-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 relative overflow-hidden ${isLoading || isReadingFile ? 'bg-slate-100 text-slate-400 border-2 border-slate-200 cursor-wait' : 'bg-[var(--theme-primary-color)] text-white shadow-xl shadow-[var(--theme-primary-color)]/30 hover:opacity-90 active:scale-95'}`}
                            >
                               {isReadingFile ? (
                                   <>
                                       <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                                       <span>Reading... {fileProgress}%</span>
                                   </>
                               ) : isLoading ? (
                                   <>
                                       <div className="w-4 h-4 border-2 border-slate-300 border-t-[var(--theme-primary-color)] rounded-full animate-spin"></div>
                                       <span>Analyzing...</span>
                                   </>
                               ) : (
                                   <>
                                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                                       <span>Drag or Upload Projects</span>
                                   </>
                               )}
                            </button>
                        </div>
                        {(isLoading || isReadingFile) && (
                            <div className="animate-fade-in-up bg-white rounded-2xl border border-indigo-100 shadow-xl p-5 relative overflow-hidden">
                                <div className="flex justify-between items-center mb-3 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                        <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest">{isReadingFile ? 'Processing...' : progressMsg}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-indigo-600">{isReadingFile ? fileProgress : Math.round(uploadProgress)}%</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner relative z-10">
                                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-[gradient-x_2s_linear_infinite] bg-[length:200%_100%] transition-all duration-300 ease-out shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${isReadingFile ? fileProgress : uploadProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                        <button 
                          onClick={isLoading || isReadingFile ? handleCancelOperation : handleClearAll}
                          className={`w-full py-4 rounded-xl text-[9px] font-black uppercase transition-all border ${isLoading || isReadingFile ? 'bg-white text-rose-500 border-rose-200' : 'bg-rose-50/50 text-rose-400 border-rose-100 hover:bg-rose-500 hover:text-white'}`}
                        >
                            {isReadingFile || isLoading ? 'Cancel' : 'Clear All'}
                        </button>
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" multiple accept="*" onChange={handleFileSelect} />
                   <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverImageChange} />
                   <input type="file" ref={profilePhotoInputRef} className="hidden" accept="image/*" onChange={handleProfilePhotoChange} />
              </div>
          </div>
      </aside>
      <main className="flex-grow bg-slate-100 overflow-y-auto custom-scrollbar relative z-10 h-full">
          <div className="min-h-full bg-white shadow-inner" ref={previewContentRef}>
            {activeTemplate === 'Minimalist' && <MinimalistTemplate {...templateProps} />}
            {activeTemplate === 'Professional' && <ProfessionalTemplate {...templateProps} />}
            {activeTemplate === 'Creative' && <CreativeTemplate {...templateProps} />}
            {activeTemplate === 'Retro' && <RetroTemplate {...templateProps} />}
            {activeTemplate === 'Studio' && <StudioTemplate {...templateProps} />}
            {activeTemplate === 'Pop' && <PopTemplate {...templateProps} />}
          </div>
      </main>
      {showShareModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col relative animate-scale-in max-h-[90vh]">
                  <button onClick={() => setShowShareModal(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all z-50 font-bold">✕</button>
                  <div className="p-10 border-b border-slate-100 bg-slate-50 flex flex-col items-center text-center">
                      <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[9px] font-black uppercase tracking-[0.2em] mb-4 text-indigo-600">Deployment Center</div>
                      <h2 className="text-3xl md:text-4xl font-black leading-tight text-slate-900 mb-4">Choose Your Launch Strategy</h2>
                      <p className="text-slate-500 text-sm font-medium max-w-2xl mx-auto">Select how you want to share your portfolio. From instant local previews to permanent global hosting.</p>
                  </div>
                  <div className="p-10 bg-white overflow-y-auto custom-scrollbar">
                      <div className="grid md:grid-cols-3 gap-8">
                          {/* Plan A */}
                          <div className="p-8 rounded-[2rem] border-2 border-slate-100 hover:border-slate-200 transition-all flex flex-col relative group">
                              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 text-slate-400 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </div>
                              <h3 className="font-black text-xl text-slate-900 mb-1">Raw Preview</h3>
                              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">PLAN A • LOCAL CHECK</p>
                              <p className="text-xs text-slate-500 mb-8 flex-grow leading-relaxed">Quick basic sanity check. Opens the raw HTML in a new tab immediately.</p>
                              <button onClick={handleLocalPreview} className="w-full py-4 bg-slate-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg">CHECK NOW</button>
                          </div>

                          {/* Plan B */}
                          <div className="p-8 rounded-[2rem] border-2 border-emerald-100 bg-emerald-50/10 flex flex-col relative ring-1 ring-emerald-50 group">
                              <div className="absolute top-6 right-6 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">RECOMMENDED</div>
                              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              </div>
                              <h3 className="font-black text-xl text-slate-900 mb-1">Public Host Bundle</h3>
                              <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mb-4">PLAN B • FOR SHARING</p>
                              <p className="text-xs text-slate-500 mb-6 leading-relaxed">Generate a real, shareable HTTPS link for recruiters.</p>
                              
                              <div className="bg-white p-5 rounded-xl border border-slate-100 mb-6 shadow-sm">
                                  <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wide">How to deploy:</p>
                                  <ol className="text-[11px] text-slate-600 space-y-2 list-decimal pl-4 font-medium leading-relaxed">
                                      <li>Download & <strong>Unzip/Extract</strong> the file.</li>
                                      <li>Drag the <strong>entire folder</strong> to <a href="https://app.netlify.com/drop" target="_blank" className="text-indigo-600 underline hover:text-indigo-800">Netlify Drop</a>.</li>
                                      <li className="text-rose-500 font-bold">Link is temporary (1 hour).</li>
                                      <li><strong>Sign up</strong> on Netlify to keep it permanent.</li>
                                  </ol>
                              </div>

                              <button onClick={() => handleDownloadWebsite(true)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 mt-auto">DOWNLOAD BUNDLE</button>
                          </div>

                          {/* Plan C */}
                          <div className={`p-8 rounded-[2rem] border-2 transition-all flex flex-col relative group ${hostedUrl ? 'border-indigo-200 bg-indigo-50' : 'border-indigo-50 hover:border-indigo-200'}`}>
                              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              </div>
                              <h3 className="font-black text-xl text-slate-900 mb-1">Instant Live Preview</h3>
                              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4">PLAN C • SPEED DEMO</p>
                              <p className="text-xs text-slate-500 mb-8 flex-grow leading-relaxed">Instantly render your portfolio in the browser. Zero latency. Perfect for demonstrating the final result during a presentation.</p>
                              <button onClick={handleLocalPreview} disabled={isPublishing} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">{isPublishing ? 'LOADING...' : 'LAUNCH DEMO'}</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
      {activeModalId && <ProjectViewerModal project={portfolioData.projects.find(x => x.id === activeModalId)!} onClose={() => setActiveModalId(null)} />}
    </div>
  );
};
