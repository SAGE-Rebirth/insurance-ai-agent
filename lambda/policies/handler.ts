import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { connectDB, Policy } from '../shared/db';
import { getRedis, cacheGet, cacheSet, cacheDel } from '../shared/redis';
import { getSecrets } from '../shared/secrets';

const SECRET_NAME = process.env.SECRET_NAME!;
const LIST_CACHE_KEY = 'policies:all';
const LIST_TTL = 300;  // 5 minutes — policies rarely change
const ITEM_TTL = 300;

const cors = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

async function bootstrap() {
    const secrets = await getSecrets(SECRET_NAME);
    await connectDB(secrets.MONGODB_URI);
    return getRedis(secrets.REDIS_URL);
}

const ok = (body: unknown, status = 200): APIGatewayProxyResultV2 => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify(body),
});

const err = (message: string, status = 400): APIGatewayProxyResultV2 => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify({ success: false, message }),
});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    if (event.requestContext.http.method === 'OPTIONS') {
        return { statusCode: 204, headers: cors, body: '' };
    }

    const redis = await bootstrap();
    const method = event.requestContext.http.method;
    const id = event.pathParameters?.id;

    try {
        // GET /api/policies — list (metadata only, no content for speed)
        if (method === 'GET' && !id) {
            const cached = await cacheGet<object[]>(redis, LIST_CACHE_KEY);
            if (cached) return ok({ success: true, data: cached, source: 'cache' });

            const policies = await Policy.find().sort({ updatedAt: -1 }).select('name createdAt updatedAt').lean();
            await cacheSet(redis, LIST_CACHE_KEY, policies, LIST_TTL);
            return ok({ success: true, data: policies, source: 'db' });
        }

        // GET /api/policies/{id} — full content
        if (method === 'GET' && id) {
            const cacheKey = `policies:${id}`;
            const cached = await cacheGet<object>(redis, cacheKey);
            if (cached) return ok({ success: true, data: cached, source: 'cache' });

            const policy = await Policy.findById(id).lean();
            if (!policy) return err('Policy not found', 404);
            await cacheSet(redis, cacheKey, policy, ITEM_TTL);
            return ok({ success: true, data: policy, source: 'db' });
        }

        // POST /api/policies — create
        if (method === 'POST' && !id) {
            const { name, content } = JSON.parse(event.body ?? '{}');
            if (!name || !content) return err('Missing required fields: name, content');

            const policy = await Policy.create({ name: name.trim(), content });
            await cacheDel(redis, LIST_CACHE_KEY);
            return ok({ success: true, data: policy }, 201);
        }

        // DELETE /api/policies/{id}
        if (method === 'DELETE' && id) {
            const result = await Policy.findByIdAndDelete(id);
            if (!result) return err('Policy not found', 404);
            await cacheDel(redis, LIST_CACHE_KEY, `policies:${id}`);
            return ok({ success: true, message: 'Policy deleted.' });
        }

        return err('Method not allowed', 405);

    } catch (e) {
        console.error('[Policies] Handler error:', e);
        return err('Internal server error', 500);
    }
}
