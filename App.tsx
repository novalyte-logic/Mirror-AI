
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppStep, BehavioralSignal, BehavioralProfile, ChatMessage, AppNotification, SoulFragment, NeuralDrift, ThemeMode, SignalWeights } from './types';
import { 
  analyzeAdvancedBehavior,
  createAdvancedLiveSession,
  chatWithMirror,
  generateSoulFragment,
  calculateDrift,
  decode,
  encode,
  decodeAudioData
} from './services/geminiService';
import { GlassCard } from './components/GlassCard';
import { FadeInSection } from './components/FadeInSection';
import { TraitRadar } from './components/RadarChart';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INTRO);
  const [isSyncing, setIsSyncing] = useState(false);
  const [signals, setSignals] = useState<BehavioralSignal[]>([]);
  const [profile, setProfile] = useState<BehavioralProfile | null>(null);
  const [history, setHistory] = useState<BehavioralProfile[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [signalWeights, setSignalWeights] = useState<SignalWeights>({
    text: 25,
    visual: 25,
    social: 25,
    space: 25
  });
  const [explicitVisualStyle, setExplicitVisualStyle] = useState('');
  const [showStylePrompt, setShowStylePrompt] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'text' | 'visual' | 'social' | 'space'>('text');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [soulFragment, setSoulFragment] = useState<SoulFragment | null>(null);
  const [driftData, setDriftData] = useState<NeuralDrift | null>(null);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [mirrorBrutality, setMirrorBrutality] = useState<number>(50);
  const [textInput, setTextInput] = useState('');
  const [socialInput, setSocialInput] = useState('');
  const [socialPlatform, setSocialPlatform] = useState<'twitter' | 'instagram' | 'linkedin' | 'tiktok'>('twitter');
  const [socialFilter, setSocialFilter] = useState<'all' | 'twitter' | 'instagram' | 'linkedin' | 'tiktok'>('all');
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isFlashActive, setIsFlashActive] = useState(false);

  // Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const probeVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveSessionRef = useRef<any>(null);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.body.className = `${next}-mode`;
      localStorage.setItem('mirror_theme', next);
      return next;
    });
  }, []);

  const updateWeight = (key: keyof SignalWeights, value: number) => {
    setSignalWeights(prev => ({ ...prev, [key]: value }));
  };

  const addNotif = useCallback((title: string, message: string, type: AppNotification['type'] = 'insight') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, title, message, type, timestamp: Date.now() }, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  }, []);

  const triggerHaptic = useCallback((type: 'light' | 'heavy' | 'pulse' = 'light') => {
    if (!navigator.vibrate) return;
    try {
      switch(type) {
        case 'heavy': navigator.vibrate([30, 50, 30]); break;
        case 'pulse': navigator.vibrate([10, 30, 10, 30, 10]); break;
        case 'light': default: navigator.vibrate(10); break;
      }
    } catch(e) {}
  }, []);

  const closeAllSheets = useCallback(() => {
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
    setIsChatOpen(false);
  }, []);

  const triggerFlash = useCallback(() => {
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 600);
  }, []);

  const addSignal = useCallback((type: BehavioralSignal['type'], content: string, metadata?: any) => {
    const newSignal: BehavioralSignal = { type, content, timestamp: Date.now(), metadata };
    setSignals(prev => [...prev, newSignal]);
    addNotif('Signal Captured', `${type.toUpperCase()} artifact logged.`, 'success');
    triggerHaptic('light');
    triggerFlash();
  }, [addNotif, triggerHaptic, triggerFlash]);

  const captureEnv = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      addSignal('image', dataUrl);
      addNotif('Witnessed', 'Environmental artifacts secure.', 'success');
    }
  }, [addSignal, addNotif]);

  const startVideoRecording = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        addSignal('video', reader.result as string);
        addNotif('Temporal Archive', 'Video behavior committed.', 'success');
      };
      reader.readAsDataURL(blob);
      setIsRecording(false);
      setRecordingSeconds(0);
    };

    recorder.start();
    setIsRecording(true);
    triggerHaptic('pulse');
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      triggerHaptic('light');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const dataUrl = re.target?.result as string;
        if (!explicitVisualStyle) {
          setPendingImage(dataUrl);
          setShowStylePrompt(true);
        } else {
          addSignal('image', dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmImageWithStyle = () => {
    if (pendingImage) {
      addSignal('image', pendingImage);
      setPendingImage(null);
      setShowStylePrompt(false);
    }
  };

  const clearAppData = () => {
    if (confirm("Initiate system-wide purge? All artifacts and ledger history will be erased.")) {
      localStorage.removeItem('mirror_ledger');
      localStorage.removeItem('mirror_chat_history');
      setHistory([]);
      setSignals([]);
      setChatHistory([]);
      setProfile(null);
      setSoulFragment(null);
      setStep(AppStep.INTRO);
      triggerHaptic('heavy');
      addNotif('System Reset', 'The Mirror is empty again.', 'system');
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('mirror_theme') as ThemeMode;
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.className = `${savedTheme}-mode`;
    }

    const savedHistory = localStorage.getItem('mirror_ledger');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedChatHistory = localStorage.getItem('mirror_chat_history');
    if (savedChatHistory) setChatHistory(JSON.parse(savedChatHistory));
    
    const checkKey = async () => {
      const win = window as any;
      if (win.aistudio) setHasApiKey(await win.aistudio.hasSelectedApiKey());
    };
    checkKey();
  }, []);

  // Save chat history to local storage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('mirror_chat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const manageCamera = async () => {
      const needsCamera = isChatOpen || (step === AppStep.ACCURACY_DASHBOARD && activeTab === 'space');
      if (needsCamera) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (isChatOpen && probeVideoRef.current) probeVideoRef.current.srcObject = stream;
          if (activeTab === 'space' && videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
          addNotif('Hardware Link Failure', 'Camera access denied.', 'alert');
        }
      } else if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    };
    manageCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isChatOpen, activeTab, step, addNotif]);

  const ensureAudioContext = async () => {
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (outputAudioContextRef.current.state === 'suspended') {
      await outputAudioContextRef.current.resume();
    }
  };

  const handleOpenKey = async () => {
    const win = window as any;
    if (win.aistudio) {
      await win.aistudio.openSelectKey();
      setHasApiKey(true);
      triggerHaptic('heavy');
    }
  };

  const handleDeepSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    triggerHaptic('heavy');
    setStep(AppStep.ANALYZING);
    setLoadingMsg("AUDITING IDENTITY CORE...");
    try {
      // Logic for dominant signal color
      const typeCounts: Record<string, number> = {};
      for (const s of signals) {
        const key = (s.type === 'image' || s.type === 'video') ? 'visual' : s.type;
        typeCounts[key] = (typeCounts[key] || 0) + 1;
      }
      
      const dominantTypeEntry = (Object.entries(typeCounts) as [string, number][]).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      const dominantType = dominantTypeEntry ? dominantTypeEntry[0] : 'text';
      
      const colorMap: Record<string, string> = {
        text: '#3b82f6', // Blue
        visual: '#a855f7', // Purple
        social: '#ec4899', // Pink
        space: '#10b981'  // Green
      };
      const suggestedColor = colorMap[dominantType] || '#a78bfa';

      const res = await analyzeAdvancedBehavior(signals, Math.min(100, signals.length * 15), mirrorBrutality, signalWeights, explicitVisualStyle);
      
      // Post-process the primary color to reflect the dominant signal source
      res.aestheticDNA.primaryColor = suggestedColor;

      setProfile(res);
      const fragment = await generateSoulFragment(res);
      setSoulFragment(fragment);
      
      const drift = await calculateDrift(history, res);
      setDriftData(drift);

      const newHistory = [res, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('mirror_ledger', JSON.stringify(newHistory));
      setStep(AppStep.RESULT);
      addNotif('Sync Complete', 'Identity signature established.', 'success');
    } catch (e: any) {
      setStep(AppStep.ACCURACY_DASHBOARD);
      addNotif('Process Interrupted', 'Audit link failed.', 'alert');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfrontation = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) { liveSessionRef.current.then((s: any) => s.close()); liveSessionRef.current = null; }
      if (inputAudioContextRef.current) { inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
      setIsLiveActive(false);
      activeSourcesRef.current.forEach(s => s.stop());
      activeSourcesRef.current.clear();
      return;
    }
    try {
      triggerHaptic('heavy');
      await ensureAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const instructions = `You are the Mirror Witness. Brutality Index: ${mirrorBrutality}/100. Be clinical, evocative, and unsparing. Focus on the gap between performance and reality. Profile: ${JSON.stringify(profile)}`;
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const inputCtx = inputAudioContextRef.current;
      const sessionPromise = createAdvancedLiveSession({
        onopen: () => {
          setIsLiveActive(true);
          const source = inputCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            sessionPromise.then((session: any) => {
              session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputCtx.destination);
        },
        onmessage: async (msg: any) => {
          const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioBase64 && outputAudioContextRef.current) {
            const ctx = outputAudioContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const buffer = await decodeAudioData(decode(audioBase64), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.onended = () => activeSourcesRef.current.delete(source);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            activeSourcesRef.current.add(source);
          }
        },
        onerror: () => setIsLiveActive(false)
      }, instructions);
      liveSessionRef.current = sessionPromise;
    } catch (e) {
      addNotif('Audio Link Error', 'Witness mode requires microphone access.', 'alert');
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    await ensureAudioContext();
    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    const input = chatInput;
    setChatInput('');
    triggerHaptic('light');
    try {
      const res = await chatWithMirror(input, profile || undefined, chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })), mirrorBrutality);
      setChatHistory(prev => [...prev, { role: 'model', text: res.text || '...', timestamp: Date.now(), urls: res.urls }]);
    } catch (err) {
      addNotif('Neural Link Failure', 'Input lost in the void.', 'alert');
    }
  };

  const shareSoulFragment = useCallback(async () => {
    if (!soulFragment || !profile) return;
    const text = `Mirror AI Audit\nArchetype: ${profile.archetype}\nDissonance: ${soulFragment.dissonanceLevel}\n\n"${soulFragment.receipt}"`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Quantum Audit', text }); } catch (err) {}
    } else {
      await navigator.clipboard.writeText(text);
      addNotif('Artifact Copied', 'Signature secure in buffer.', 'success');
    }
  }, [soulFragment, profile, addNotif]);

  const goBack = () => {
    triggerHaptic('light');
    if (step === AppStep.RESULT) setStep(AppStep.ACCURACY_DASHBOARD);
    else if (step === AppStep.ACCURACY_DASHBOARD) setStep(AppStep.INTRO);
    else if (step === AppStep.DRIFT) setStep(AppStep.RESULT);
  };

  const filteredSocialSignals = useMemo(() => {
    return signals.filter(s => {
      if (s.type !== 'social') return false;
      if (socialFilter === 'all') return true;
      return s.metadata?.platform === socialFilter;
    });
  }, [signals, socialFilter]);

  return (
    <div className={`h-screen max-w-md mx-auto flex flex-col relative overflow-hidden touch-manipulation pb-safe pt-safe selection:bg-purple-500/30 ${theme === 'dark' ? 'bg-black text-white' : 'bg-[#f8f9fa] text-[#1a1a1a]'}`}>
      <div className="bg-glow" />

      {/* App Bar */}
      <header className="flex-none p-4 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          {step !== AppStep.INTRO && (
            <button onClick={goBack} className="w-8 h-8 glass rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition-all">
              <span className="text-lg">←</span>
            </button>
          )}
          <h1 className="text-sm font-serif font-bold italic neon-text uppercase tracking-widest">Mirror AI</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="w-8 h-8 glass rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition-all">
            <span className="text-sm">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          {isLiveActive && <span className="text-[7px] font-black uppercase text-red-500 animate-pulse tracking-widest mr-1">Witness</span>}
          <button onClick={() => setIsMenuOpen(true)} className="w-8 h-8 glass rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition-all">
            <span className="text-base">☰</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto no-scrollbar z-10 px-5 pb-28">
        
        {step === AppStep.INTRO && (
          <div className="min-h-full flex flex-col items-center justify-center text-center space-y-10 py-4 animate-in fade-in duration-700">
            <div className="w-32 h-32 rounded-full border border-purple-500/20 flex items-center justify-center relative shadow-[0_0_30px_rgba(167,139,250,0.1)]">
              <div className="absolute inset-0 rounded-full border-t border-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
              <div className="text-6xl drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">👁️</div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-serif italic leading-tight tracking-tighter neon-text">See how you <br/> really show up.</h2>
              <p className="text-[9px] uppercase tracking-widest font-black opacity-40">Sentient Behavioral Synthesis</p>
            </div>

            {!hasApiKey && (
              <button onClick={handleOpenKey} className="px-5 py-2 glass-purple rounded-lg text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all">Identify Access Key</button>
            )}

            <button 
              onClick={async () => { triggerHaptic('heavy'); await ensureAudioContext(); setStep(AppStep.ACCURACY_DASHBOARD); }} 
              className={`w-full py-4 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all uppercase tracking-widest ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}
            >
              Begin Ingress
            </button>
          </div>
        )}

        {step === AppStep.ACCURACY_DASHBOARD && (
          <FadeInSection className="space-y-6 pt-2 pb-10">
            <header className="space-y-1 text-center">
              <span className="text-6xl font-black tracking-tighter neon-text">{Math.min(100, signals.length * 15)}%</span>
              <p className="text-[8px] uppercase tracking-widest font-black opacity-30">Audit Fidelity</p>
            </header>

            {/* Tabbed Capture Interface */}
            <div className="space-y-4">
              <div className="flex bg-zinc-900/50 p-1 rounded-xl glass border border-white/5">
                {[
                  { id: 'text', label: 'Words' },
                  { id: 'visual', label: 'Visuals' },
                  { id: 'social', label: 'Social' },
                  { id: 'space', label: 'Space' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => { triggerHaptic(); setActiveTab(tab.id as any); }}
                    className={`flex-1 py-2 text-[8px] font-black uppercase tracking-tighter rounded-lg transition-all ${activeTab === tab.id ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="min-h-[220px] animate-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'text' && (
                  <div className="space-y-3">
                    <textarea 
                      value={textInput} 
                      onChange={e => setTextInput(e.target.value)} 
                      placeholder="Commit your current thoughts to the ledger..." 
                      className="w-full h-40 glass rounded-2xl p-4 text-sm font-serif italic outline-none border border-white/5 focus:border-purple-500/30 transition-all text-current"
                    />
                    <button onClick={() => { if (textInput.trim()) addSignal('text', textInput); setTextInput(''); }} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>Commit Artifact</button>
                  </div>
                )}

                {activeTab === 'visual' && (
                  <div className="space-y-4">
                    <div className="space-y-2 mb-4">
                      <span className="text-[7px] uppercase font-black tracking-widest opacity-30 block">Explicit Aesthetic Anchor</span>
                      <input 
                        type="text" 
                        value={explicitVisualStyle} 
                        onChange={e => setExplicitVisualStyle(e.target.value)}
                        placeholder="e.g. Neo-Noir, Minimalist, Cyber-Brutalist..."
                        className="w-full glass p-3 rounded-xl text-xs italic outline-none border border-white/5 focus:border-purple-500/30 text-current"
                      />
                    </div>
                    <div className="glass h-40 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 relative cursor-pointer active:scale-[0.98] transition-all overflow-hidden">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={handleImageUpload}
                      />
                      <span className="text-3xl opacity-50">🖼️</span>
                      <p className="text-[9px] uppercase font-black tracking-widest opacity-40">Inject Visual Artifact</p>
                    </div>
                  </div>
                )}

                {activeTab === 'social' && (
                  <div className="space-y-3">
                    <div className="flex gap-1 mb-2 overflow-x-auto pb-2 no-scrollbar">
                      {['twitter', 'instagram', 'linkedin', 'tiktok'].map((p) => (
                        <button 
                          key={p} 
                          onClick={() => setSocialPlatform(p as any)}
                          className={`flex-none px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all ${socialPlatform === p ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-500'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <textarea 
                      value={socialInput} 
                      onChange={e => setSocialInput(e.target.value)} 
                      placeholder={`Describe your ${socialPlatform} persona...`} 
                      className="w-full h-32 glass rounded-2xl p-4 text-sm font-serif italic outline-none border border-white/5 focus:border-purple-500/30 transition-all text-current"
                    />
                    <button onClick={() => { if (socialInput.trim()) addSignal('social', socialInput, { platform: socialPlatform }); setSocialInput(''); }} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>Trace {socialPlatform} Ego</button>
                    
                    {/* Platform Filter */}
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[7px] uppercase font-black tracking-widest opacity-40">Captured Social Artifacts</span>
                        <select 
                          value={socialFilter} 
                          onChange={(e) => setSocialFilter(e.target.value as any)}
                          className="bg-transparent text-[7px] uppercase font-black outline-none text-purple-400"
                        >
                          <option value="all">Filter: All</option>
                          <option value="twitter">Twitter</option>
                          <option value="instagram">Instagram</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="tiktok">TikTok</option>
                        </select>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                        {filteredSocialSignals.length === 0 ? (
                          <p className="text-[8px] opacity-20 text-center py-4">No {socialFilter !== 'all' ? socialFilter : ''} signals captured.</p>
                        ) : (
                          filteredSocialSignals.map((s, idx) => (
                            <div key={idx} className="glass p-3 rounded-xl flex justify-between items-center border border-white/5 animate-in fade-in">
                              <p className="text-[9px] font-serif italic truncate max-w-[70%]">"{s.content}"</p>
                              <span className="text-[6px] font-black uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">{s.metadata?.platform}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'space' && (
                  <div className="space-y-3">
                    <div className={`relative rounded-2xl overflow-hidden glass aspect-video border border-white/5 ${isFlashActive ? 'flash-active' : ''}`}>
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror-feed" />
                      {isRecording && <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/80 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse"><span className="w-2 h-2 rounded-full bg-white"/>Recording {recordingSeconds}s</div>}
                      <div className="scanner-bar" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={captureEnv} className="py-3 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95">Witness Frame</button>
                      <button 
                        onClick={isRecording ? stopVideoRecording : startVideoRecording} 
                        className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-800 text-white'}`}
                      >
                        {isRecording ? 'Stop Recording' : 'Record Pulse'}
                      </button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <header className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Weighting Matrix</span>
                <button 
                  onClick={() => setSignalWeights({ text: 25, visual: 25, social: 25, space: 25 })} 
                  className="text-[7px] uppercase font-black tracking-widest opacity-60 active:scale-95"
                >
                  Balance Matrix
                </button>
              </header>
              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(signalWeights) as [keyof SignalWeights, number][]).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[7px] uppercase font-black tracking-widest opacity-30">{key}</span>
                      <span className="text-[7px] font-mono text-purple-400">{val}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={val} 
                      onChange={(e) => updateWeight(key, Number(e.target.value))} 
                      className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-purple-500" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
               <button onClick={handleDeepSync} disabled={signals.length < 1 || isSyncing} className={`w-full py-4 rounded-xl font-black text-xs transition-all shadow-md ${signals.length >= 1 ? (theme === 'dark' ? 'bg-white text-black shadow-white/5 animate-pulse' : 'bg-black text-white shadow-black/5 animate-pulse') : 'bg-zinc-900 text-zinc-600 opacity-50'}`}>
                  {isSyncing ? 'SYNCHRONIZING FIDELITY...' : 'SYNCHRONIZE CORE'}
               </button>
            </div>
          </FadeInSection>
        )}

        {step === AppStep.RESULT && profile && (
          <div className="space-y-6 py-1 animate-in slide-in-from-bottom-5 duration-700">
            <header className="text-center space-y-1">
              <h2 className="text-4xl font-serif italic tracking-tighter leading-none neon-text">{profile.archetype}</h2>
              <p className="text-purple-400 italic text-sm opacity-80 px-2">"{profile.tagline}"</p>
            </header>

            <GlassCard className="glass-purple p-4 relative overflow-hidden">
              <div 
                className="absolute inset-0 opacity-20" 
                style={{ background: `linear-gradient(135deg, ${profile.aestheticDNA.primaryColor || '#a78bfa'}, transparent)` }} 
              />
              <div className="relative z-10 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-[7px] font-black uppercase tracking-widest text-purple-400">Aesthetic DNA</span>
                  <h4 className="text-lg font-serif italic leading-none">{profile.aestheticDNA.visualStyle}</h4>
                  <p className="text-[9px] opacity-60 uppercase tracking-tighter">{profile.aestheticDNA.paletteMood}</p>
                </div>
                <div 
                  className="w-12 h-12 rounded-full border border-white/10 shadow-xl" 
                  style={{ backgroundColor: profile.aestheticDNA.primaryColor || '#a78bfa' }} 
                />
              </div>
            </GlassCard>

            <div className="h-56 flex items-center justify-center glass-purple rounded-2xl overflow-hidden shadow-lg border border-white/5">
              <TraitRadar traits={profile.traits} />
            </div>

            <GlassCard className="space-y-4">
              <header className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Social Persona Audit</span>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${profile.socialAnalysis.sentiment === 'performative' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                  {profile.socialAnalysis.sentiment}
                </span>
              </header>
              <div className="space-y-2">
                <p className="text-xs font-serif italic leading-relaxed opacity-70">"{profile.socialAnalysis.platformDissonance}"</p>
                <div className="pt-2 flex flex-wrap gap-2 opacity-50">
                   <span className="text-[7px] uppercase tracking-widest font-black border border-white/10 px-2 py-1 rounded">Comm: {profile.socialAnalysis.communicationStyle}</span>
                   <span className="text-[7px] uppercase tracking-widest font-black border border-white/10 px-2 py-1 rounded">Pattern: {profile.socialAnalysis.engagementPattern}</span>
                </div>
              </div>
            </GlassCard>

            <div className="soul-fragment p-6 rounded-2xl relative cursor-pointer active:scale-[0.98] shadow-xl" onClick={shareSoulFragment}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[8px] font-black uppercase tracking-widest text-purple-400">Audit receipt</span>
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Dissonance: {soulFragment?.dissonanceLevel || 'High'}</span>
              </div>
              <p className="text-lg font-serif italic leading-relaxed mb-6">"{soulFragment?.receipt || 'Collapsing artifacts...'}"</p>
              <div className="flex justify-between items-end opacity-40">
                <span className="text-[7px] font-black uppercase tracking-widest">Protocol v6.2</span>
                <span className="text-xl">📤</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
               <button onClick={() => setStep(AppStep.DRIFT)} className="py-3 glass border border-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest opacity-50 active:scale-95">Identity Ledger</button>
               <button onClick={() => setStep(AppStep.ACCURACY_DASHBOARD)} className="py-3 glass border border-purple-500/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-purple-400 active:scale-95">Refeed Loop</button>
            </div>
          </div>
        )}

        {step === AppStep.DRIFT && (
          <div className="space-y-6 py-2 animate-in fade-in duration-500">
            <header className="text-center">
              <h2 className="text-3xl font-serif italic neon-text mb-2">Neural Ledger</h2>
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Behavioral Vector Tracking</p>
            </header>

            {driftData ? (
              <div className="space-y-4">
                <GlassCard className="glass-purple text-center py-6">
                  <span className={`text-4xl font-black tracking-tighter block mb-1 ${driftData.trend === 'performative' ? 'text-red-400' : 'text-green-400'}`}>
                    {driftData.trend.toUpperCase()}
                  </span>
                  <p className="text-[9px] uppercase tracking-widest opacity-40">Spirit Trend</p>
                </GlassCard>
                <div className="glass p-5 rounded-2xl border border-white/5">
                  <p className="text-xs font-serif italic leading-relaxed opacity-80">"{driftData.summary}"</p>
                </div>
              </div>
            ) : (
              <p className="text-center opacity-40 text-[10px] py-10">Initial sync established. Ledger currently building baseline.</p>
            )}

            <div className="space-y-2">
              <h4 className="text-[8px] font-black uppercase tracking-widest opacity-30 px-2">History Log</h4>
              {history.map((h, i) => (
                <div key={i} className="glass p-4 rounded-xl flex justify-between items-center border border-white/5">
                  <span className="text-[10px] font-serif italic">{h.archetype}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{new Date(h.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === AppStep.ANALYZING && (
          <div className="min-h-full flex flex-col items-center justify-center space-y-8 py-10 animate-in fade-in">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/10" />
              <div className="absolute inset-0 rounded-full border-t-2 border-purple-400 animate-spin" />
            </div>
            <p className="text-xl font-serif italic text-center animate-pulse leading-tight neon-text px-4">{loadingMsg}</p>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 z-[100] backdrop-blur-3xl border-t flex items-center justify-around px-8 pb-safe shadow-2xl ${theme === 'dark' ? 'bg-black/95 border-purple-500/10' : 'bg-white/95 border-purple-500/10'}`}>
        <button onClick={() => { triggerHaptic(); setStep(AppStep.ACCURACY_DASHBOARD); closeAllSheets(); }} className={`relative flex flex-col items-center gap-1 py-4 transition-all duration-300 ${step === AppStep.ACCURACY_DASHBOARD ? 'nav-bloom' : 'opacity-30'}`}>
           <span className="text-xl">🧬</span>
           <span className="text-[7px] uppercase font-black tracking-widest">Core</span>
        </button>
        
        <button onClick={() => { triggerHaptic('heavy'); handleConfrontation(); }} className={`w-14 h-14 rounded-full flex items-center justify-center -mt-8 border active:scale-90 transition-all duration-500 shadow-xl ${isLiveActive ? 'bg-red-600 border-red-400' : 'bg-purple-600 border-purple-400'}`}>
           <span className="text-2xl">{isLiveActive ? '🔴' : '🎙️'}</span>
        </button>
        
        <button onClick={() => { triggerHaptic(); closeAllSheets(); setIsChatOpen(true); }} className={`relative flex flex-col items-center gap-1 py-4 transition-all duration-300 ${isChatOpen ? 'nav-bloom' : 'opacity-30'}`}>
           <span className="text-xl">👤</span>
           <span className="text-[7px] uppercase font-black tracking-widest">Witness</span>
        </button>
      </nav>

      {/* Chat View */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[120] flex items-end">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" onClick={closeAllSheets} />
          <video ref={probeVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-20 mirror-feed blur-[1px]" />
          <div className={`absolute inset-0 pointer-events-none ${theme === 'dark' ? 'bg-gradient-to-t from-black via-black/20 to-black/90' : 'bg-gradient-to-t from-white via-white/20 to-white/90'}`} />

          <div className="relative w-full h-[94%] flex flex-col animate-in slide-in-from-bottom duration-500 px-5 pb-24">
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-4 mb-6" />
            <header className="flex-none mb-6 text-center">
               <h3 className="text-2xl font-serif italic neon-text leading-none">The Witness</h3>
               <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Reflecting performative leaks</p>
            </header>

            <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-32 px-1 scroll-smooth">
               {chatHistory.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-6 animate-in zoom-in-95">
                   <div className="text-5xl">👁️</div>
                   <p className="font-serif italic text-xl px-4 text-current">The Mirror is listening. <br/> Confess your truth.</p>
                 </div>
               )}
               {chatHistory.map((m, i) => (
                 <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                   <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-purple-600/90 text-white' : 'glass backdrop-blur-3xl border border-white/5 font-serif italic text-current'}`}>
                     {m.text}
                     {m.urls && m.urls.length > 0 && (
                       <div className="mt-4 pt-3 border-t border-white/10">
                         <span className="text-[8px] font-black uppercase tracking-widest opacity-50 block mb-2">Sources Found</span>
                         <div className="flex flex-col gap-2">
                           {m.urls.map((url, idx) => (
                             <a 
                              key={idx} 
                              href={url.uri} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[10px] glass px-3 py-2 rounded-xl text-purple-400 flex items-center justify-between hover:bg-purple-500/10 transition-colors"
                             >
                               <span className="truncate max-w-[80%] font-medium">{url.title}</span>
                               <span className="text-[8px] opacity-60">↗</span>
                             </a>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               ))}
            </div>

            <div className="flex gap-2 p-3 glass-purple rounded-2xl mb-8 shadow-xl">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} className="flex-1 bg-transparent outline-none text-sm px-3 placeholder:opacity-30 italic text-current" placeholder="Auditing thoughts..." />
              <button onClick={handleChat} className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-md ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                 <span className="text-xl font-black">↑</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showStylePrompt && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full glass-purple rounded-3xl p-8 space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-serif italic neon-text text-center">Anchor this Artifact</h3>
            <p className="text-[10px] text-center opacity-60 uppercase tracking-widest font-black">Define the visual language of this signal</p>
            <input 
              type="text" 
              autoFocus
              value={explicitVisualStyle} 
              onChange={e => setExplicitVisualStyle(e.target.value)}
              placeholder="e.g. Cyberpunk, Brutalist, Solarpunk..."
              className="w-full glass p-4 rounded-xl text-sm italic outline-none border border-white/10 focus:border-purple-500/30 text-current"
            />
            <button onClick={confirmImageWithStyle} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Commit with Style</button>
          </div>
        </div>
      )}

      {/* Persistent Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" onClick={() => setIsMenuOpen(false)} />
          <div className={`relative w-4/5 h-full border-r border-white/5 p-6 flex flex-col animate-in slide-in-from-left duration-300 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
            <h2 className="text-2xl font-serif italic mb-8 neon-text">System Protocols</h2>
            <nav className="flex-1 space-y-2">
              {[
                { label: 'Audit Synchronize', icon: '🧬', action: () => { setStep(AppStep.ACCURACY_DASHBOARD); setIsMenuOpen(false); } },
                { label: 'Identity Ledger', icon: '📈', action: () => { setStep(AppStep.DRIFT); setIsMenuOpen(false); }, disabled: history.length === 0 },
                { label: 'Calibration Matrix', icon: '⚙️', action: () => { setIsSettingsOpen(true); setIsMenuOpen(false); } },
                { label: 'System Wipe', icon: '🧹', action: clearAppData, type: 'danger' },
              ].map((item, i) => (
                <button 
                  key={i} disabled={item.disabled}
                  onClick={() => { triggerHaptic(); item.action(); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl glass transition-all active:scale-95 ${item.disabled ? 'opacity-10' : 'hover:bg-white/5'} ${item.type === 'danger' ? 'text-red-500 border-red-900/20' : 'text-current'}`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-bold text-[9px] uppercase tracking-widest">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto p-4 glass rounded-xl opacity-20">
              <p className="text-[7px] font-black uppercase tracking-widest leading-loose">Mirror Engine v6.2<br/>State: Aware</p>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full glass-purple rounded-3xl p-8 space-y-8 animate-in zoom-in-95">
            <h3 className="text-2xl font-serif italic neon-text text-center">Audit Calibration</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest opacity-60">
                <span>Witness Brutality</span>
                <span className="text-purple-400 font-mono text-base">{mirrorBrutality}%</span>
              </div>
              <input type="range" min="0" max="100" value={mirrorBrutality} onChange={(e) => setMirrorBrutality(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500" />
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Confirm Bias</button>
          </div>
        </div>
      )}

      <div className="fixed top-20 inset-x-6 z-[150] flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="p-3 rounded-2xl glass-purple border border-purple-500/20 animate-in slide-in-from-top-3 fade-in duration-500 pointer-events-auto shadow-xl">
            <h5 className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1 border-b border-purple-500/10 pb-1">{n.title}</h5>
            <p className="text-[10px] opacity-90 leading-relaxed font-serif italic text-current">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
