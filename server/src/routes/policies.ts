import { Router, Request, Response } from 'express';
import { Policy } from '../models/Policy';
import { getCache, setCache, deleteCache } from '../config/redis';
import { createError } from '../middleware/errorHandler';

const router = Router();
const LIST_CACHE_KEY = 'policies:all';
const CACHE_TTL = 300; // 5 minutes — policies change infrequently

// GET /api/policies — list all stored policies
router.get('/', async (_req: Request, res: Response) => {
    const cached = await getCache<object[]>(LIST_CACHE_KEY);
    if (cached) {
        return res.json({ success: true, data: cached, source: 'cache' });
    }

    const policies = await Policy.find()
        .sort({ updatedAt: -1 })
        .select('name createdAt updatedAt')
        .lean();

    await setCache(LIST_CACHE_KEY, policies, CACHE_TTL);
    return res.json({ success: true, data: policies, source: 'db' });
});

// GET /api/policies/:id — get a specific policy (with content)
router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const cacheKey = `policies:${id}`;

    const cached = await getCache<object>(cacheKey);
    if (cached) {
        return res.json({ success: true, data: cached, source: 'cache' });
    }

    const policy = await Policy.findById(id).lean();
    if (!policy) throw createError('Policy not found', 404);

    await setCache(cacheKey, policy, CACHE_TTL);
    return res.json({ success: true, data: policy, source: 'db' });
});

// POST /api/policies — save a new policy
router.post('/', async (req: Request, res: Response) => {
    const { name, content } = req.body;

    if (!name || !content) {
        throw createError('Missing required fields: name, content', 400);
    }

    const policy = await Policy.create({ name: name.trim(), content });
    await deleteCache(LIST_CACHE_KEY);

    return res.status(201).json({ success: true, data: policy });
});

// DELETE /api/policies/:id — delete a policy
router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await Policy.findByIdAndDelete(id);
    if (!result) throw createError('Policy not found', 404);

    await deleteCache(LIST_CACHE_KEY);
    await deleteCache(`policies:${id}`);
    return res.json({ success: true, message: 'Policy deleted.' });
});

export default router;
