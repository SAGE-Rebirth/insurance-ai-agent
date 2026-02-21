import Redis from 'ioredis';

// ── Module-level singleton ────────────────────────────────────────────────────
let redisClient: Redis | null = null;

/**
 * Get or create the Redis client.
 * Reused across warm Lambda invocations.
 */
export function getRedis(url: string): Redis {
    if (redisClient && redisClient.status === 'ready') return redisClient;

    redisClient = new Redis(url, {
        maxRetriesPerRequest: 2,       // Fail fast in Lambda context
        connectTimeout: 3000,
        commandTimeout: 2000,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy: (times) => {
            if (times > 3) return null; // Give up after 3 retries
            return Math.min(times * 100, 500);
        },
    });

    redisClient.on('error', (err) => console.warn('[Redis] Error:', err.message));
    redisClient.on('connect', () => console.log('[Redis] Connected (cold start)'));

    return redisClient;
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function cacheGet<T>(redis: Redis, key: string): Promise<T | null> {
    try {
        const val = await redis.get(key);
        return val ? (JSON.parse(val) as T) : null;
    } catch {
        return null; // Never crash a Lambda over a cache miss
    }
}

export async function cacheSet(redis: Redis, key: string, value: unknown, ttl = 60): Promise<void> {
    try {
        await redis.setex(key, ttl, JSON.stringify(value));
    } catch {
        // Cache write failure is non-fatal
    }
}

export async function cacheDel(redis: Redis, ...keys: string[]): Promise<void> {
    try {
        if (keys.length > 0) await redis.del(...keys);
    } catch {
        // Cache delete failure is non-fatal
    }
}

export async function cacheDelPattern(redis: Redis, pattern: string): Promise<void> {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) await redis.del(...keys);
    } catch {
        // Non-fatal
    }
}
