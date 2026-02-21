import { Router, Request, Response } from 'express';
import { Session } from '../models/Session';
import { getCache, setCache, deleteCache, deleteCacheByPattern } from '../config/redis';
import { createError } from '../middleware/errorHandler';

const router = Router();
const CACHE_KEY = 'sessions:all';
const CACHE_TTL = 60; // 60 seconds

// GET /api/sessions — list all sessions (cached)
router.get('/', async (req: Request, res: Response) => {
    // Try cache first
    const cached = await getCache<object[]>(CACHE_KEY);
    if (cached) {
        return res.json({ success: true, data: cached, source: 'cache' });
    }

    const sessions = await Session.find()
        .sort({ createdAt: -1 })
        .select('-__v')
        .lean();

    // Format for frontend compatibility
    const formatted = sessions.map((s) => ({
        id: s.sessionId,
        timestamp: s.createdAt,
        logs: s.logs,
        policySummary: s.policySummary,
    }));

    await setCache(CACHE_KEY, formatted, CACHE_TTL);
    return res.json({ success: true, data: formatted, source: 'db' });
});

// POST /api/sessions — save a new session
router.post('/', async (req: Request, res: Response) => {
    const { id, timestamp, logs, policySummary } = req.body;

    if (!id || !logs || !Array.isArray(logs)) {
        throw createError('Missing required fields: id, logs', 400);
    }

    // Upsert — safe if client retries the same session
    const session = await Session.findOneAndUpdate(
        { sessionId: id },
        {
            sessionId: id,
            logs,
            policySummary: policySummary || '',
        },
        { upsert: true, new: true, runValidators: true }
    );

    // Invalidate cache after write
    await deleteCache(CACHE_KEY);

    return res.status(201).json({
        success: true,
        data: {
            id: session.sessionId,
            timestamp: session.createdAt,
            logs: session.logs,
            policySummary: session.policySummary,
        },
    });
});

// DELETE /api/sessions — clear ALL sessions
router.delete('/', async (_req: Request, res: Response) => {
    await Session.deleteMany({});
    await deleteCacheByPattern('sessions:*');
    return res.json({ success: true, message: 'All sessions cleared.' });
});

// DELETE /api/sessions/:id — delete a specific session
router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await Session.findOneAndDelete({ sessionId: id });

    if (!result) {
        throw createError('Session not found', 404);
    }

    await deleteCache(CACHE_KEY);
    return res.json({ success: true, message: 'Session deleted.' });
});

export default router;
