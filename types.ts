export interface AudioConfig {
  sampleRate: number;
  channels: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  RECONNECTING = 'RECONNECTING',
}

export interface PolicyDocument {
  title: string;
  content: string;
}

export interface LogMessage {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  message: string;
}

export interface StoredSession {
  id: string;
  timestamp: string; // ISO string
  logs: LogMessage[];
  policySummary?: string; // Optional short descriptor
}

export type SupportedLanguage = 'en' | 'hi' | 'gu' | 'ml' | 'mr' | 'te' | 'ta';

export const LANGUAGES: { id: SupportedLanguage; label: string; nativeName: string }[] = [
  { id: 'en', label: 'English', nativeName: 'English' },
  { id: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { id: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી' },
  { id: 'mr', label: 'Marathi', nativeName: 'मराठी' },
  { id: 'ml', label: 'Malayalam', nativeName: 'മലയാളം' },
  { id: 'te', label: 'Telugu', nativeName: 'తెలుగు' },
  { id: 'ta', label: 'Tamil', nativeName: 'தமிழ்' },
];