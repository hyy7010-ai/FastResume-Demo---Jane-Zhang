
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { PortfolioData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface Message {
  role: 'ai' | 'user';
  text: string;
  feedback?: {
    pros: string;
    cons: string;
    suggestion: string;
  };
}

interface InterviewHistoryItem {
    id: string;
    timestamp: number;
    score: number;
    summary: string;
    topic: string;
    duration: number;
    messages: Message[];
    interviewer: string;
    mode: string;
}

interface MockInterviewProps {
    jdText?: string;
    portfolioData?: PortfolioData;
}

type InterviewTopic = 'General' | 'Technical' | 'Behavioral' | 'Project Deep-Dive';
type InterviewerGender = 'female' | 'male';
type Duration = 5 | 10 | 15;

export const MockInterview: React.FC<MockInterviewProps> = ({ jdText: mainPageJd, portfolioData }) => {
  const [interviewStatus, setInterviewStatus] = useState<'idle' | 'initializing' | 'active' | 'completed'>('idle');
  const [aiState, setAiState] = useState<'listening' | 'processing' | 'speaking' | 'idle'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Vision Analysis State
  const [visionFeedback, setVisionFeedback] = useState<{ expression: string; eyeContact: number } | null>(null);
  
  // Timer State
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  
  // Configuration State
  const [selectedTopic, setSelectedTopic] = useState<InterviewTopic>('General');
  const [interviewerGender, setInterviewerGender] = useState<InterviewerGender>('female');
  const [jdSource, setJdSource] = useState<'sync' | 'custom'>('sync');
  const [customJd, setCustomJd] = useState('');
  const [mode, setMode] = useState<'text' | 'voice' | 'face'>('voice');
  const [duration, setDuration] = useState<Duration>(10);
  const [isMuted, setIsMuted] = useState(false);
  const [micActive, setMicActive] = useState(false);
  
  const [finalReport, setFinalReport] = useState<any>(null);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const visionIntervalRef = useRef<any>(null);
  const isInterviewActiveRef = useRef(false);
  
  // Audio Context Refs for Ambience
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambienceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // State Refs for Event Listeners
  const aiStateRef = useRef(aiState);
  const interviewStatusRef = useRef(interviewStatus);
  const modeRef = useRef(mode);
  const isMutedRef = useRef(isMuted);

  useEffect(() => { aiStateRef.current = aiState; }, [aiState]);
  useEffect(() => { interviewStatusRef.current = interviewStatus; }, [interviewStatus]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Video Ref Callback to ensure stream is attached immediately when element mounts
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && stream) {
        node.srcObject = stream;
        node.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream]);

  const activeJd = jdSource === 'sync' ? (mainPageJd || 'Standard professional interview') : customJd;

  // Countdown Timer Logic
  useEffect(() => {
    if (interviewStatus === 'active' && secondsRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            handleStop();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [interviewStatus, secondsRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load history and voices
  useEffect(() => {
    const saved = localStorage.getItem('interview_history_v6'); 
    if (saved) {
        try {
            setHistory(JSON.parse(saved));
        } catch(e) {
            console.error("Failed to parse history", e);
        }
    }

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Auto-scroll the message bubble
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentInput, aiState]);

  // Ambient Noise Generator
  const startAmbience = () => {
      try {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          audioContextRef.current = ctx;

          const bufferSize = ctx.sampleRate * 2;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);

          let lastOut = 0;
          for (let i = 0; i < bufferSize; i++) {
              const white = Math.random() * 2 - 1;
              data[i] = (lastOut + (0.02 * white)) / 1.02;
              lastOut = data[i];
              data[i] *= 3.5; 
          }

          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          noise.loop = true;
          
          const gainNode = ctx.createGain();
          gainNode.gain.value = 0.01; 
          
          noise.connect(gainNode);
          gainNode.connect(ctx.destination);
          noise.start();
          ambienceNodeRef.current = noise;
      } catch (e) {
          console.error("Ambience failed", e);
      }
  };

  const stopAmbience = () => {
      try {
          if (ambienceNodeRef.current) ambienceNodeRef.current.stop();
          if (audioContextRef.current) audioContextRef.current.close();
      } catch(e) {}
  };

  const handleSend = async (text: string) => {
      if (!isInterviewActiveRef.current || !text.trim() || aiStateRef.current !== 'listening') return;
      
      setAiState('processing');
      setMessages(prev => [...prev, { role: 'user', text }]);
      setCurrentInput('');

      const systemInstruction = `
        Role: ${interviewerGender === 'female' ? 'Olivia' : 'James'}, Senior Recruiter.
        Task: Conduct a professional interview for: ${activeJd}
        
        STRICT RULES:
        1. Speak naturally and conversationally.
        2. DO NOT output stage directions. 
        3. DO NOT prefix your response with your name.
        4. Ask ONE clear follow-up question at a time.
        5. Keep responses concise (under 3 sentences).
        
        Format: 
        ANALYSIS_START
        ✅ [Strength]
        ⚠️ [Improvement]
        ANALYSIS_END
        
        [Your spoken response here]
      `;

      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: [{ text: `Candidate response: ${text}` }],
              config: { systemInstruction }
          });
          if (!isInterviewActiveRef.current) return;
          const raw = response.text || "";
          const analysisMatch = raw.match(/ANALYSIS_START([\s\S]*?)ANALYSIS_END/);
          const nextQuestion = raw.replace(/ANALYSIS_START[\s\S]*?ANALYSIS_END/, '').trim();
          
          let feedback = undefined;
          if (analysisMatch) {
              const fbLines = analysisMatch[1].split('\n').filter(l => l.trim());
              feedback = { 
                pros: fbLines.find(l => l.includes('✅'))?.replace('✅', '').trim() || "Good point.",
                cons: fbLines.find(l => l.includes('⚠️'))?.replace('⚠️', '').trim() || "Expand further.",
                suggestion: ''
              };
          }
          setMessages(prev => [...prev, { role: 'ai', text: nextQuestion, feedback }]);
          speakText(nextQuestion);
      } catch (e) { setAiState('listening'); }
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => { handleSendRef.current = handleSend; });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech Recognition is not supported in this browser. Please use Chrome or Edge.");
        setMode('text');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        setMicActive(true);
    };

    recognition.onend = () => {
        setMicActive(false);
        if (
            interviewStatusRef.current === 'active' && 
            aiStateRef.current === 'listening' && 
            modeRef.current !== 'text' && 
            !isMutedRef.current
        ) {
            try { 
                recognition.start(); 
            } catch(e) {}
        }
    };

    recognition.onerror = (event: any) => {
        console.error("Recognition error", event.error);
        if (event.error === 'not-allowed') {
            setMicPermissionGranted(false);
            alert("Microphone access was blocked. Please check your browser permissions.");
            setMode('text');
        }
    };

    recognition.onresult = (event: any) => {
        if (!isInterviewActiveRef.current) return;
        
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        if (interimTranscript) {
          setCurrentInput(interimTranscript);
        }
        
        if (finalTranscript.trim()) {
            setCurrentInput(finalTranscript);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            // Increased pause duration to 2.5 seconds to avoid cutting off user
            silenceTimerRef.current = setTimeout(() => {
                if (isInterviewActiveRef.current && aiStateRef.current === 'listening') {
                    handleSendRef.current(finalTranscript);
                }
            }, 2500); 
        } else if (interimTranscript) {
            // Keep timer alive if we have interim results
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
               // Fallback if final never comes but silence detected
               if (isInterviewActiveRef.current && aiStateRef.current === 'listening') {
                   handleSendRef.current(interimTranscript);
               }
            }, 3000);
        }
    };

    recognitionRef.current = recognition;
    return () => {
        recognition.stop();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []); 

  useEffect(() => {
      const recognition = recognitionRef.current;
      if (!recognition) return;

      if (interviewStatus === 'active' && aiState === 'listening' && mode !== 'text' && !isMuted) {
          try { recognition.start(); } catch(e) {}
      } else {
          try { recognition.stop(); } catch(e) {}
      }
  }, [aiState, interviewStatus, mode, isMuted]);

  useEffect(() => {
    if (interviewStatus === 'active' && mode === 'face') {
        visionIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || !hiddenCanvasRef.current) return;
            
            const context = hiddenCanvasRef.current.getContext('2d');
            if (!context) return;
            
            context.drawImage(videoRef.current, 0, 0, 300, 200);
            const base64Image = hiddenCanvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
            
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                            { text: "Analyze the facial expression in 1 word (e.g. Confident, Nervous, Focused) and rate eye contact 1-5. Return JSON: { \"expression\": string, \"eyeContact\": number }" }
                        ]
                    },
                    config: { responseMimeType: "application/json" }
                });
                const result = JSON.parse(response.text || '{}');
                if (result.expression) {
                    setVisionFeedback(result);
                }
            } catch (e) {}
        }, 3000);
    } else {
        if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    }

    return () => {
        if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    };
  }, [interviewStatus, mode]);


  const cleanTextForSpeech = (text: string) => {
      return text
        .replace(/[*_#`]/g, '')
        .replace(/\(.*?\)/g, '') 
        .replace(/\[.*?\]/g, '')
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') 
        .trim();
  };

  const speakText = useCallback((text: string) => {
      const cleanText = cleanTextForSpeech(text);
      if (!cleanText) return;

      if ('speechSynthesis' in window && !isMuted) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          const isFemale = interviewerGender === 'female';
          
          let preferredVoice = voices.find(v => 
             v.name.toLowerCase().includes(isFemale ? 'female' : 'male') && 
             v.lang.startsWith('en')
          );
          
          if (!preferredVoice) {
              if (isFemale) {
                  preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Zira'));
              } else {
                  preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Daniel') || v.name.includes('David'));
              }
          }

          if (preferredVoice) utterance.voice = preferredVoice;
          
          utterance.rate = 1.0;
          utterance.pitch = isFemale ? 1.1 : 0.85; 

          setAiState('processing');
          setTimeout(() => {
              setAiState('speaking');
              utterance.onend = () => {
                  if (isInterviewActiveRef.current) {
                      setAiState('listening');
                      setCurrentInput('');
                  } else { setAiState('idle'); }
              };
              synthesisRef.current = utterance;
              window.speechSynthesis.speak(utterance);
          }, 50);
      } else {
          setAiState('speaking');
          setTimeout(() => {
              if (isInterviewActiveRef.current) {
                  setAiState('listening');
                  setCurrentInput('');
              } else { setAiState('idle'); }
          }, text.length * 30);
      }
  }, [voices, interviewerGender, isMuted]);

  const handleStart = async () => {
      let currentMode = mode; 
      let mediaStream = null;

      if (currentMode === 'face') {
          try {
              mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              setStream(mediaStream);
              setMicPermissionGranted(true);
              startAmbience(); 
          } catch (err) {
              console.error("Camera access denied", err);
              alert("Camera/Mic access denied. Falling back to Voice mode.");
              currentMode = 'voice';
              setMode('voice');
          }
      } 
      
      if (currentMode === 'voice' && !mediaStream) {
           try {
              const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              setMicPermissionGranted(true);
              setStream(audioStream); 
           } catch (err) {
              console.error("Mic access denied", err);
              alert("Microphone access denied. Falling back to Text mode.");
              setMode('text');
              setMicPermissionGranted(false);
           }
      }

      isInterviewActiveRef.current = true;
      setInterviewStatus('initializing');
      setSecondsRemaining(duration * 60);
      setMessages([]);
      setFinalReport(null);
      setVisionFeedback(null);
      
      const interviewerName = interviewerGender === 'female' ? 'Olivia' : 'James';
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: [{ text: `Start the interview now. Introduce yourself as ${interviewerName} and ask the first question. Do NOT include any scene descriptions or stage directions.` }]
          });
          const greeting = response.text || `Hi, I'm ${interviewerName}. Let's begin.`;
          setInterviewStatus('active');
          setMessages([{ role: 'ai', text: greeting }]);
          speakText(greeting);
      } catch (e) {
          setInterviewStatus('active');
          setMessages([{ role: 'ai', text: `Hello, let's start the interview.` }]);
          speakText(`Hello, let's start the interview.`);
      }
  };

  const handleStop = async () => {
      isInterviewActiveRef.current = false;
      setInterviewStatus('completed');
      setReportLoading(true); 
      setAiState('idle');
      window.speechSynthesis.cancel();
      stopAmbience();
      
      if (recognitionRef.current) recognitionRef.current.stop();
      if (stream) {
          stream.getTracks().forEach(t => t.stop());
          setStream(null);
      }
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
      
      const userWordCount = messages.filter(m => m.role === 'user').reduce((acc, m) => acc + m.text.split(' ').length, 0);
      let report: any = null;

      // Handle Short Session Manually
      if (userWordCount < 10) {
          report = {
              score: 10,
              summary: "The session was terminated early with insufficient candidate input.",
              strengths: ["Session Initiated"],
              improvements: ["Provide verbal responses", "Check microphone input"],
              mistakes: ["Silence detected"]
          };
      } else {
          // Generate AI Report
          try {
              const transcript = messages.map(m => `${m.role}: ${m.text}`).join('\n');
              const systemInstruction = `
                Role: Strict Senior Talent Acquisition Director.
                Task: Grade this interview transcript HARSHLY. 
                OUTPUT JSON: { "score": number (0-100), "summary": "string", "strengths": [], "improvements": [], "mistakes": [] }
              `;

              const res = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: [{ text: `Transcript:\n${transcript}` }],
                  config: { responseMimeType: "application/json", systemInstruction }
              });
              report = JSON.parse(res.text || '{}');
          } catch (e) {
              console.error("Report generation failed", e);
              report = {
                  score: 0,
                  summary: "Analysis unavailable due to network error.",
                  strengths: [], improvements: [], mistakes: ["Network Error"]
              };
          }
      }

      // Save History regardless of success/fail state
      if (report) {
          setFinalReport(report);
          const newHistory: InterviewHistoryItem = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              score: report.score || 0,
              summary: report.summary || '',
              topic: selectedTopic,
              duration: duration,
              messages: [...messages], 
              interviewer: interviewerGender === 'female' ? 'Olivia' : 'James',
              mode: mode 
          };

          setHistory(prev => {
              const updated = [newHistory, ...prev].slice(0, 15);
              localStorage.setItem('interview_history_v6', JSON.stringify(updated));
              return updated;
          });
      }
      setReportLoading(false);
  };

  const loadPastSession = (item: InterviewHistoryItem) => {
      setFinalReport({ score: item.score, summary: item.summary, strengths: [], improvements: [], mistakes: [] });
      setMessages(item.messages);
      setInterviewStatus('completed');
  };

  const lastAiFeedback = messages.filter(m => m.feedback).slice(-1)[0]?.feedback;

  const handleDownloadReport = async () => {
        if (!reportRef.current) return;
        const html2pdf = (window as any).html2pdf;
        const element = reportRef.current.querySelector('.a4-report-container');
        const opt = { margin: 0, filename: `Interview_Report_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        await html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="w-full h-[calc(100vh-100px)] animate-fade-in overflow-hidden relative flex bg-slate-50/50">
        <canvas ref={hiddenCanvasRef} width="300" height="200" className="hidden" />

        <div className="w-full md:w-[350px] p-6 flex flex-col gap-6 overflow-hidden shrink-0 border-r border-slate-200 bg-white z-20 h-full">
            {interviewStatus === 'idle' || interviewStatus === 'initializing' ? (
                <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar h-full">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col gap-6">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Interview Lab</h2>
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Practice Context</label><div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100"><button onClick={() => setJdSource('sync')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black transition-all ${jdSource === 'sync' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>RESUME JD</button><button onClick={() => setJdSource('custom')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black transition-all ${jdSource === 'custom' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>CUSTOM</button></div>{jdSource === 'custom' && (<textarea value={customJd} onChange={(e) => setCustomJd(e.target.value)} placeholder="Paste specific requirements..." className="w-full h-24 p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] outline-none focus:border-indigo-500 resize-none" />)}</div>
                        <div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Recruiter</label><div className="grid grid-cols-2 gap-3"><button onClick={() => setInterviewerGender('female')} className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${interviewerGender === 'female' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}><span className="text-3xl">👩‍💼</span><span className="text-[10px] font-black uppercase">Olivia</span></button><button onClick={() => setInterviewerGender('male')} className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${interviewerGender === 'male' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}><span className="text-3xl">👨‍💼</span><span className="text-[10px] font-black uppercase">James</span></button></div></div>
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Duration</label><div className="flex bg-slate-50 p-1.5 rounded-2xl">{[5, 10, 15].map(d => (<button key={d} onClick={() => setDuration(d as any)} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${duration === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{d}m</button>))}</div></div>
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mode</label><div className="flex bg-slate-900 p-1.5 rounded-2xl shadow-inner">{['text', 'voice', 'face'].map(m => (<button key={m} onClick={() => setMode(m as any)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${mode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}>{m}</button>))}</div></div>
                        <button onClick={handleStart} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-2xl transition-all active:scale-[0.98]">START SESSION</button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full gap-6">
                    <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6 shrink-0">
                        <div className="flex justify-between items-start"><div><h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span> Live Info</h2><div className="text-2xl font-black tabular-nums text-indigo-600 mt-2">{formatTime(secondsRemaining)} <span className="text-[10px] text-slate-400">LEFT</span></div></div><button onClick={handleStop} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg font-black text-[9px] uppercase border border-rose-100 hover:bg-rose-50 transition-colors">END</button></div>
                        <button onClick={() => setIsMuted(!isMuted)} className={`w-full py-4 rounded-2xl font-black text-[10px] border-2 transition-all ${isMuted ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{isMuted ? 'UNMUTE MIC' : 'MUTE MIC'}</button>
                        {mode === 'face' && visionFeedback && (<div className="p-4 bg-slate-50 rounded-2xl border border-slate-200"><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Vision Analysis</h4><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-700">Expression</span><span className="text-xs font-black text-indigo-600">{visionFeedback.expression}</span></div><div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-700">Eye Contact</span><div className="flex gap-1">{[...Array(5)].map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i < visionFeedback.eyeContact ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>))}</div></div></div>)}
                    </div>
                    <div className="flex-grow bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 shrink-0">Expert Feedback</h3><div className="flex-grow overflow-y-auto custom-scrollbar space-y-5">{messages.filter(m => m.feedback).slice().reverse().map((m, i) => (<div key={i} className={`p-5 rounded-3xl border ${i === 0 ? 'bg-indigo-50 border-indigo-100' : 'opacity-40 grayscale'}`}><p className="text-[11px] font-bold text-slate-700 leading-relaxed mb-3">✅ {m.feedback?.pros}</p><p className="text-[11px] font-bold text-slate-600 italic">💡 {m.feedback?.cons}</p></div>))}</div></div>
                </div>
            )}
        </div>

        <div className="flex-grow bg-white p-6 flex flex-col items-center justify-center relative overflow-hidden h-full">
            <div className="w-full max-w-5xl h-full bg-slate-950 rounded-[3.5rem] shadow-2xl overflow-hidden relative flex flex-col group">
                {interviewStatus === 'active' && lastAiFeedback && (
                    <div className="absolute top-8 left-8 z-40 w-full max-w-lg">
                        <div className="bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-3xl p-5 flex gap-6 shadow-2xl items-center ring-1 ring-white/5">
                            <div className="flex items-center gap-3 flex-1"><div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px] font-black">✓</div><span className="text-[10px] font-bold text-white leading-tight">{lastAiFeedback.pros}</span></div>
                            <div className="w-px h-8 bg-white/10 shrink-0"></div>
                            <div className="flex items-center gap-3 flex-1"><div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white text-[9px] font-black">!</div><span className="text-[10px] font-bold text-white/90 leading-tight italic">{lastAiFeedback.cons}</span></div>
                        </div>
                    </div>
                )}
                
                {interviewStatus === 'active' && mode === 'face' && (
                    <div className="absolute top-6 right-6 w-56 aspect-video bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-50 ring-4 ring-black/50">
                            <video ref={setVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                            <div className="absolute bottom-2 left-2 flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div><span className="text-[9px] font-black text-white/80 uppercase tracking-widest">Live</span></div>
                    </div>
                )}

                {/* REFACTORED: Use flex-col instead of absolute positioning for better spacing */}
                <div className="flex flex-col h-full w-full relative z-10">
                    
                    {/* Content Area - Grows to take available space */}
                    <div className="flex-grow flex flex-col items-center justify-center p-8 text-center overflow-y-auto custom-scrollbar">
                        {interviewStatus === 'idle' || interviewStatus === 'initializing' ? (
                            <div className="flex flex-col items-center animate-fade-in"><div className="w-48 h-48 bg-white/5 rounded-full flex items-center justify-center text-7xl mb-10 border border-white/10 relative shadow-2xl overflow-hidden"><div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-[50px] animate-pulse"></div>{interviewStatus === 'initializing' ? '⏳' : '🎤'}</div><h2 className="text-white text-4xl font-black mb-4 tracking-tighter">AI Recruiter Studio</h2><p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">{interviewStatus === 'initializing' ? 'Warming up the studio...' : 'Ready for your high-stakes simulation.'}</p></div>
                        ) : (
                            <div className="w-full flex flex-col items-center justify-center h-full max-w-4xl relative">
                                <div className={`w-32 h-32 md:w-44 md:h-44 rounded-full flex items-center justify-center relative transition-transform duration-300 ${aiState === 'speaking' ? 'scale-110' : ''}`}><div className={`absolute inset-0 bg-indigo-600/40 rounded-full blur-[80px] transition-opacity duration-300 ${aiState === 'speaking' ? 'opacity-100' : 'opacity-0'}`}></div><div className="w-28 h-28 md:w-40 md:h-40 bg-slate-900 rounded-full flex items-center justify-center z-10 border-[8px] border-white/5 shadow-2xl relative ring-1 ring-white/10"><span className="text-6xl md:text-7xl select-none">{aiState === 'speaking' ? (interviewerGender === 'female' ? '👩‍💼' : '👨‍💼') : aiState === 'listening' ? '👂' : '🤔'}</span></div></div>
                                <div className="w-full max-w-2xl bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col min-h-[220px] relative mt-12"><div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.3em] z-20 shadow-2xl transition-colors duration-300 ${aiState === 'speaking' ? 'bg-indigo-600' : aiState === 'listening' ? 'bg-emerald-600' : 'bg-slate-700'} text-white`}>{aiState === 'speaking' ? (interviewerGender === 'female' ? 'Olivia' : 'James') : aiState === 'listening' ? 'Listening' : 'Processing...'}</div><div ref={scrollRef} className="overflow-y-auto custom-scrollbar pr-4 flex-grow flex items-start justify-center max-h-[300px]"><p className="text-white text-lg md:text-2xl font-medium leading-[1.6] tracking-tight text-center pt-2">{aiState === 'listening' ? (currentInput ? `"${currentInput}"` : <span className="text-slate-500 italic opacity-40">I'm listening, please speak...</span>) : messages.filter(m => m.role === 'ai').length > 0 ? cleanTextForSpeech(messages.filter(m => m.role === 'ai').slice(-1)[0].text) : "Initializing..."}</p></div>{aiState === 'listening' && (<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 h-3 items-end">{[...Array(5)].map((_, i) => <div key={i} className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: `${30 + Math.random()*70}%`, animationDelay: `${i*0.1}s` }}></div>)}</div>)}</div>
                            </div>
                        )}
                    </div>

                    {/* Input Area - Static Footer */}
                    <div className="w-full p-8 md:p-12 bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 z-30 shrink-0">
                        <div className="max-w-3xl mx-auto flex gap-6 items-center">
                            <div className="relative flex-grow"><input value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend(currentInput)} placeholder={mode === 'text' ? "Type response..." : "I'm listening, please speak..."} className="w-full bg-white/[0.04] border border-white/10 text-white px-10 py-6 rounded-[2rem] outline-none font-bold text-xl placeholder:text-slate-800" disabled={aiState !== 'listening' && interviewStatus === 'active'} />{aiState === 'listening' && (<div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${micActive ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]' : 'bg-slate-700'}`}></div><span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{micActive ? 'Listening' : 'Standby'}</span></div>)}</div>
                            <button onClick={() => handleSend(currentInput)} disabled={aiState !== 'listening' || !currentInput.trim()} className="w-20 h-20 bg-white text-slate-950 rounded-[2rem] flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-2xl disabled:opacity-5 active:scale-90 shrink-0"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className={`fixed top-24 right-0 h-[calc(100vh-140px)] z-[100] transition-all duration-700 flex ${showHistoryPanel ? 'translate-x-0' : 'translate-x-[calc(100%-56px)]'}`}>
            <button onClick={() => setShowHistoryPanel(!showHistoryPanel)} className="w-14 bg-white/90 backdrop-blur-xl h-32 my-auto rounded-l-[1.5rem] flex flex-col items-center justify-center gap-4 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all group hover:w-16"><div style={{ writingMode: 'vertical-rl' }} className="rotate-180 text-[10px] font-black tracking-[0.3em] uppercase">HISTORY</div><div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">{history.length}</div></button>
            <div className="w-96 h-full bg-white border-l border-slate-200 shadow-[-40px_0_100px_rgba(0,0,0,0.15)] flex flex-col"><div className="p-8 border-b border-slate-100 flex justify-between items-center"><div><h3 className="text-2xl font-black text-slate-900 tracking-tighter">History</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Previous Logs</p></div><button onClick={() => { if(confirm("Clear history?")) { setHistory([]); localStorage.removeItem('interview_history_v6'); } }} className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em]">Reset</button></div><div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4 bg-slate-50/50">{history.map(h => (<div key={h.id} onClick={() => loadPastSession(h)} className="p-6 rounded-[2.5rem] bg-white border border-slate-200 hover:border-indigo-400 cursor-pointer transition-all hover:shadow-xl group flex flex-col justify-between shadow-sm"><div className="flex justify-between items-center mb-4"><span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{new Date(h.timestamp).toLocaleDateString()}</span><div className="text-base font-black text-slate-900">{h.score}%</div></div><div className="flex flex-wrap gap-y-2 gap-x-3 mb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-3"><span className="flex items-center gap-1"><span className="text-slate-300">Time:</span> {new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span><span className="flex items-center gap-1"><span className="text-slate-300">By:</span> {h.interviewer}</span><span className="flex items-center gap-1"><span className="text-slate-300">Len:</span> {h.duration}m</span><span className="flex items-center gap-1"><span className="text-slate-300">Mode:</span> {h.mode || 'Voice'}</span></div><p className="text-[14px] text-slate-700 font-medium line-clamp-4 leading-relaxed italic opacity-90">"{h.summary}"</p></div>))}{history.length === 0 && <div className="flex flex-col items-center justify-center h-full text-center opacity-30"><div className="text-4xl mb-4">📂</div><p className="text-[11px] font-black uppercase tracking-widest">No Sessions Found</p></div>}</div></div>
        </div>

        {interviewStatus === 'completed' && reportLoading && (<div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in"><div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div><h2 className="text-2xl font-black mb-2 tracking-tight">Generating Performance Report...</h2><p className="text-slate-400 font-medium animate-pulse">Analyzing speech patterns, content, and sentiment.</p></div>)}

        {interviewStatus === 'completed' && finalReport && !reportLoading && (
            <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10 animate-fade-in overflow-y-auto">
                <div className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10 relative">
                    <button onClick={() => setInterviewStatus('idle')} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-all font-bold text-2xl z-50">×</button>
                    <div className="overflow-y-auto custom-scrollbar flex-grow bg-white" ref={reportRef}>
                        <div className="a4-report-container max-w-[210mm] mx-auto bg-white p-12 min-h-[297mm] shadow-sm relative">
                            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
                            <div className="flex justify-between items-end border-b-2 border-slate-100 pb-8 mb-12 pt-8">
                                <div><h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Interview Evaluation</h1><p className="text-slate-500 font-medium text-sm tracking-wide">CONFIDENTIAL CANDIDATE REPORT • {new Date().toLocaleDateString()}</p></div>
                                <div className="text-right flex flex-col items-end">
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-[6px] border-indigo-50"></div>
                                        <div className="absolute inset-0 rounded-full border-[6px] border-indigo-600 border-l-transparent transform -rotate-45" style={{ opacity: finalReport.score / 100 }}></div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-5xl font-black text-indigo-600 tracking-tighter">{finalReport.score}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total Score</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4 mb-12 bg-slate-50 p-6 rounded-xl border border-slate-100"><div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Interviewer</div><div className="font-bold text-slate-800">{interviewerGender === 'female' ? 'Olivia' : 'James'}</div></div><div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</div><div className="font-bold text-slate-800">{duration} Minutes</div></div><div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mode</div><div className="font-bold text-slate-800 capitalize">{mode}</div></div><div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</div><div className="font-bold text-slate-800">{new Date().toLocaleDateString()}</div></div></div>
                            <div className="mb-12"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Executive Summary</h4><p className="text-base font-medium text-slate-700 leading-loose text-justify">{finalReport.summary}</p></div>
                            <div className="grid grid-cols-2 gap-12 mb-16"><div><h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-emerald-100 pb-2">Peak Strengths</h4><ul className="space-y-4">{(finalReport.strengths || []).map((s: any, i: number) => (<li key={i} className="text-sm font-medium text-slate-700 leading-relaxed flex items-start gap-3"><div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>{s}</li>))}</ul></div><div className="space-y-8"><div><h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-amber-100 pb-2">Growth Areas</h4><ul className="space-y-4">{(finalReport.improvements || []).map((s: any, i: number) => (<li key={i} className="text-sm font-medium text-slate-700 leading-relaxed flex items-start gap-3"><div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></div>{s}</li>))}</ul></div>{finalReport.mistakes && finalReport.mistakes.length > 0 && (<div className="bg-rose-50 p-6 rounded-xl border border-rose-100"><h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">Critical Misses</h4><ul className="space-y-3">{(finalReport.mistakes || []).map((s: any, i: number) => (<li key={i} className="text-xs font-bold text-rose-800 leading-relaxed flex items-start gap-2"><span>•</span> {s}</li>))}</ul></div>)}</div></div>
                            <div className="border-t-2 border-slate-100 pt-12 break-before-page"><h4 className="text-lg font-black text-slate-900 tracking-tight mb-8">Transcript Analysis</h4><div className="space-y-6">{messages.map((m, i) => { if (m.role === 'ai' && m.feedback) { const userAns = messages[i-1]?.role === 'user' ? messages[i-1].text : "(No audio detected)"; const question = messages[i-2]?.role === 'ai' ? messages[i-2].text : "Opening"; return (<div key={i} className="bg-slate-50 p-6 border-l-4 border-indigo-500 mb-4 break-inside-avoid"><div className="mb-3"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Interviewer</span><p className="text-xs font-bold text-slate-800 italic">"{question}"</p></div><div className="mb-4 pl-4 border-l-2 border-slate-200"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">You</span><p className="text-sm text-slate-600">"{userAns}"</p></div><div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200/50"><div><span className="text-[8px] font-black text-emerald-600 uppercase block mb-1">Analysis</span><p className="text-[10px] font-medium text-slate-700">{m.feedback.pros}</p></div><div><span className="text-[8px] font-black text-amber-600 uppercase block mb-1">Critique</span><p className="text-[10px] font-medium text-slate-700">{m.feedback.cons}</p></div></div></div>); } return null; })}</div></div>
                            <div className="mt-12 text-center border-t border-slate-100 pt-8"><p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">AI Fast Resume • Career Architecture</p></div>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-4"><button onClick={handleDownloadReport} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg flex items-center justify-center gap-3"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download PDF Report</button><button onClick={() => setInterviewStatus('idle')} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all">Close</button></div>
                </div>
            </div>
        )}
    </div>
  );
};
