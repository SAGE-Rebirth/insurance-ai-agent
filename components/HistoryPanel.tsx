import React from 'react';
import { Clock, MessageSquare, Trash2, X, FileText } from 'lucide-react';
import { StoredSession } from '../types';

interface HistoryPanelProps {
  sessions: StoredSession[];
  onClose: () => void;
  onClearHistory: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ sessions, onClose, onClearHistory }) => {
  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-slate-200">
          <Clock className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-lg">Conversation History</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No past conversations found.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 space-y-3 hover:bg-slate-800 transition-colors">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700/50">
                <span className="font-medium text-slate-300">{new Date(session.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span className="bg-slate-700/50 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide text-slate-300">
                  {session.logs.filter(l => l.role !== 'system').length} turns
                </span>
              </div>
              
              {/* Summary Section */}
              {session.policySummary && (
                  <div className="bg-blue-900/10 border border-blue-900/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-3 h-3 text-blue-400" />
                          <span className="text-[10px] font-bold uppercase text-blue-400 tracking-wider">Summary</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                          "{session.policySummary}"
                      </p>
                  </div>
              )}

              {/* Transcript Preview */}
              <div className="max-h-32 overflow-y-auto text-sm space-y-2 pr-2 scrollbar-thin opacity-70 hover:opacity-100 transition-opacity">
                {session.logs.filter(l => l.role !== 'system').slice(0, 3).map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className={`font-bold text-[10px] uppercase w-10 shrink-0 mt-0.5 ${
                      log.role === 'agent' ? 'text-blue-400' : 'text-emerald-400'
                    }`}>
                      {log.role}
                    </span>
                    <span className="text-slate-300 truncate text-xs">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {sessions.length > 0 && (
        <div className="p-4 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm">
          <button
            onClick={onClearHistory}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-900/10 hover:bg-red-900/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors border border-red-900/20"
          >
            <Trash2 className="w-4 h-4" /> Clear All History
          </button>
        </div>
      )}
    </div>
  );
};
