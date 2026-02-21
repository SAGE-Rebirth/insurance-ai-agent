import { StoredSession } from '../types';

const API_BASE = '/api';

// ─── Generic fetcher ──────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `API Error: ${res.status}`);
    }

    return res.json();
}

// ─── Session Service ──────────────────────────────────────────────────────────

export const SessionService = {
    /**
     * Fetch all sessions from MongoDB (via backend, Redis-cached).
     * Falls back to localStorage if API is unreachable.
     */
    async getAll(): Promise<StoredSession[]> {
        try {
            const response = await apiFetch<{ success: boolean; data: StoredSession[] }>('/sessions');
            return response.data ?? [];
        } catch (err) {
            console.warn('[SessionService] API unavailable, falling back to localStorage:', err);
            const raw = localStorage.getItem('insure_voice_history');
            return raw ? JSON.parse(raw) : [];
        }
    },

    /**
     * Save a session to MongoDB. Also updates localStorage as a backup.
     */
    async save(session: StoredSession): Promise<StoredSession> {
        try {
            const response = await apiFetch<{ success: boolean; data: StoredSession }>('/sessions', {
                method: 'POST',
                body: JSON.stringify(session),
            });
            // Also persist locally as backup
            const all = await SessionService.getAll();
            const updated = [response.data, ...all.filter((s) => s.id !== session.id)];
            localStorage.setItem('insure_voice_history', JSON.stringify(updated));
            return response.data;
        } catch (err) {
            console.warn('[SessionService] Save to API failed, saving to localStorage only:', err);
            const raw = localStorage.getItem('insure_voice_history');
            const existing: StoredSession[] = raw ? JSON.parse(raw) : [];
            const updated = [session, ...existing.filter((s) => s.id !== session.id)];
            localStorage.setItem('insure_voice_history', JSON.stringify(updated));
            return session;
        }
    },

    /**
     * Delete a single session by ID.
     */
    async deleteOne(id: string): Promise<void> {
        try {
            await apiFetch(`/sessions/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.warn('[SessionService] Delete from API failed:', err);
        }
        // Always clean localStorage too
        const raw = localStorage.getItem('insure_voice_history');
        if (raw) {
            const filtered = (JSON.parse(raw) as StoredSession[]).filter((s) => s.id !== id);
            localStorage.setItem('insure_voice_history', JSON.stringify(filtered));
        }
    },

    /**
     * Clear all sessions.
     */
    async clearAll(): Promise<void> {
        try {
            await apiFetch('/sessions', { method: 'DELETE' });
        } catch (err) {
            console.warn('[SessionService] Clear from API failed:', err);
        }
        localStorage.removeItem('insure_voice_history');
    },
};

// ─── Policy Service ───────────────────────────────────────────────────────────

export const PolicyService = {
    async save(name: string, content: string): Promise<void> {
        await apiFetch('/policies', {
            method: 'POST',
            body: JSON.stringify({ name, content }),
        });
    },
};
