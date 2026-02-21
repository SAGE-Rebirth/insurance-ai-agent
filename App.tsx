import React, { useState, useEffect, useCallback } from 'react';
import { useLiveApi } from './hooks/use-live-api';
import { PolicyPanel } from './components/PolicyPanel';
import { AudioVisualizer } from './components/AudioVisualizer';
import { HistoryPanel } from './components/HistoryPanel';
import { DEFAULT_POLICY_TEXT } from './constants';
import { ConnectionState, StoredSession, SupportedLanguage, LANGUAGES } from './types';
import { SessionService } from './services/api';
import {
  Mic, MicOff, Phone, PhoneOff, ShieldCheck, Activity,
  AlertCircle, History, BookOpen, User, FileText, Globe
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  const [policyText, setPolicyText] = useState(DEFAULT_POLICY_TEXT);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<StoredSession[]>([]);
  const [activeTab, setActiveTab] = useState<'agent' | 'policy'>('agent');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  // ─── Initialise: check API key + load session history ─────────────────────
  useEffect(() => {
    if (!import.meta.env.VITE_API_KEY) {
      setApiKeyMissing(true);
      return;
    }
    SessionService.getAll().then(setSessionHistory).catch(console.error);
  }, []);

  const {
    connect, disconnect, connectionState, logs,
    isMicMuted, setIsMicMuted, isMicMutedRef,
    userAnalyzerRef, agentAnalyzerRef,
  } = useLiveApi({ policyContext: policyText, language: selectedLanguage });

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isReconnecting = connectionState === ConnectionState.RECONNECTING;

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted, isMicMutedRef]);

  // ─── Summary Generation ───────────────────────────────────────────────────
  const generateSessionSummary = useCallback(async (sessionLogs: StoredSession['logs']): Promise<string> => {
    if (!import.meta.env.VITE_API_KEY || sessionLogs.length < 2) {
      return 'No sufficient conversation to summarize.';
    }
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const transcript = sessionLogs
        .filter((l) => l.role !== 'system')
        .map((l) => `${l.role.toUpperCase()}: ${l.message}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Summarize the following insurance agent conversation in 2-3 concise sentences:\n\n${transcript}`,
      });
      return response.text || 'Summary not available.';
    } catch {
      return 'Failed to generate summary.';
    }
  }, []);

  // ─── Save Session ─────────────────────────────────────────────────────────
  const saveCurrentSession = useCallback(async () => {
    if (logs.length === 0) return;

    const sessionLogs = [...logs];
    const tempId = crypto.randomUUID();

    const newSession: StoredSession = {
      id: tempId,
      timestamp: new Date().toISOString(),
      logs: sessionLogs,
      policySummary: 'Generating summary...',
    };

    // Optimistic UI update
    setSessionHistory((prev) => [newSession, ...prev]);

    // Persist to backend + generate summary in background
    const [summary] = await Promise.all([
      generateSessionSummary(sessionLogs),
      SessionService.save(newSession),
    ]);

    const finalSession: StoredSession = { ...newSession, policySummary: summary };

    setSessionHistory((prev) =>
      prev.map((s) => (s.id === tempId ? finalSession : s))
    );

    // Persist updated session with real summary
    SessionService.save(finalSession).catch(console.error);
  }, [logs, generateSessionSummary]);

  // ─── Connection Toggle ────────────────────────────────────────────────────
  const toggleConnection = useCallback(() => {
    if (isConnected || isConnecting || isReconnecting) {
      saveCurrentSession();
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, isConnecting, isReconnecting, saveCurrentSession, connect, disconnect]);

  // ─── Clear History ────────────────────────────────────────────────────────
  const handleClearHistory = useCallback(() => {
    SessionService.clearAll().catch(console.error);
    setSessionHistory([]);
  }, []);

  // ─── Missing API Key Screen ───────────────────────────────────────────────
  if (apiKeyMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Missing API Key</h1>
          <p className="text-slate-400">
            Please set <code className="text-blue-400">VITE_API_KEY</code> in your{' '}
            <code className="text-slate-300">.env.local</code> file.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-blue-500/30">

      {/* ── Header ── */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Logo + Mobile History */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">InsureVoice AI</h1>
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest">Powered by PushpakO2</p>
              </div>
            </div>

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-full relative"
            >
              <History className="w-6 h-6" />
              {sessionHistory.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-slate-900" />
              )}
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">

            {/* Language Selector */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
              <Globe className="w-4 h-4 ml-2 text-slate-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => !isConnected && setSelectedLanguage(e.target.value as SupportedLanguage)}
                disabled={isConnected || isConnecting || isReconnecting}
                className="bg-transparent text-sm text-slate-200 py-1 px-2 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200">
                    {lang.label} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-800 border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : isReconnecting ? 'bg-yellow-500' : 'bg-slate-500'}`} />
              <span className={isConnected ? 'text-green-400' : isReconnecting ? 'text-yellow-400' : 'text-slate-500'}>
                {connectionState}
              </span>
            </div>

            {/* Desktop History Button */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="hidden md:block p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all relative group"
              title="View Session History"
            >
              <History className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              {sessionHistory.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-900" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">

        {/* Mobile Tabs */}
        <div className="lg:hidden col-span-1 flex bg-slate-900/50 p-1 rounded-lg mb-2">
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'agent' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <User className="w-4 h-4" /> Agent
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'policy' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <BookOpen className="w-4 h-4" /> Policy
          </button>
        </div>

        {/* Policy Panel */}
        <div className={`lg:col-span-5 h-[calc(100vh-12rem)] lg:h-[calc(100vh-9rem)] ${activeTab === 'policy' ? 'block' : 'hidden lg:block'}`}>
          <PolicyPanel
            policyText={policyText}
            onUpdatePolicy={setPolicyText}
            disabled={isConnected || isConnecting || isReconnecting}
          />
        </div>

        {/* Agent Panel */}
        <div className={`lg:col-span-7 flex flex-col gap-4 h-[calc(100vh-12rem)] lg:h-[calc(100vh-9rem)] ${activeTab === 'agent' ? 'block' : 'hidden lg:flex'}`}>

          {/* Audio Visualizer Card */}
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl flex-1 min-h-[350px] flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950" />

            <div className="absolute inset-0 z-0 opacity-80">
              <AudioVisualizer
                userAnalyzerRef={userAnalyzerRef}
                agentAnalyzerRef={agentAnalyzerRef}
                isActive={isConnected}
                isConnecting={isConnecting || isReconnecting}
              />
            </div>

            <div className="relative z-10 w-full px-8 pb-8 flex flex-col justify-end h-full">
              {/* Status Overlay */}
              <div className="absolute top-6 left-0 right-0 text-center pointer-events-none">
                {!isConnected && !isConnecting && !isReconnecting && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/50 backdrop-blur rounded-full border border-slate-700/50">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-slate-400 text-sm font-medium">Agent Offline</span>
                  </div>
                )}
                {isConnected && (
                  <div className="inline-flex flex-col items-center animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">Agent Sathi</h2>
                    <p className="text-blue-300 text-sm font-medium opacity-80">
                      Listening ({LANGUAGES.find((l) => l.id === selectedLanguage)?.label})...
                    </p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6 mt-auto">
                {/* Mute Button */}
                <button
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  disabled={!isConnected}
                  title={isMicMuted ? 'Unmute' : 'Mute'}
                  className={`p-4 rounded-full transition-all duration-300 backdrop-blur-md border ${!isConnected
                      ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                      : isMicMuted
                        ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                        : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                    }`}
                >
                  {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Connect Button */}
                <button
                  onClick={toggleConnection}
                  className={`group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl overflow-hidden w-48 ${isConnected
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/30'
                      : isConnecting || isReconnecting
                        ? 'bg-yellow-600 cursor-wait text-white'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40'
                    }`}
                >
                  {!isConnected && (
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out skew-x-12" />
                  )}
                  {isConnected ? (
                    <><PhoneOff className="w-6 h-6" /> End</>
                  ) : isConnecting ? (
                    <>Connecting</>
                  ) : isReconnecting ? (
                    <>Cancel</>
                  ) : (
                    <><Phone className="w-6 h-6 group-hover:scale-110 transition-transform" /> Call Agent</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Live Transcript */}
          <div className="flex-none h-48 bg-slate-800 rounded-xl border border-slate-700 shadow-xl flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-700 bg-slate-900/30 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Transcript</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-slate-900/20">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-60">
                  <Activity className="w-8 h-8" />
                  <p className="text-sm italic">Ready to connect.</p>
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 text-sm animate-fade-in ${log.role === 'system' ? 'opacity-60 text-xs py-1' : ''}`}>
                  <span className={`
                    ${log.role === 'agent' ? 'text-blue-400 font-semibold' : ''}
                    ${log.role === 'user' ? 'text-emerald-400 font-semibold' : ''}
                    ${log.role === 'system' ? 'text-yellow-500/80 font-mono' : ''}
                  `}>
                    {log.role === 'agent' ? 'Agent:' : log.role === 'user' ? 'You:' : 'System:'}
                  </span>
                  <span className={`text-slate-300 ${log.role === 'system' ? 'italic' : ''}`}>{log.message}</span>
                </div>
              ))}
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </div>
        </div>

        {/* History Drawer */}
        {isHistoryOpen && (
          <HistoryPanel
            sessions={sessionHistory}
            onClose={() => setIsHistoryOpen(false)}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Global Animation Styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;