import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { connectDB, Session } from '../shared/db';
import { getRedis, cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../shared/redis';
import { getSecrets } from '../shared/secrets';

const SECRET_NAME = process.env.SECRET_NAME!;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL!;
const SESSIONS_CACHE_KEY = 'sessions:all';
const SESSIONS_TTL = 60; // seconds

const sqsClient = new SQSClient({ region: process.env.AWS_REGION ?? 'ap-south-1' });

// ── Bootstrap (runs once per cold start) ─────────────────────────────────────
async function bootstrap() {
    const secrets = await getSecrets(SECRET_NAME);
    await connectDB(secrets.MONGODB_URI);
    return getRedis(secrets.REDIS_URL);
}

// ── Response helpers ──────────────────────────────────────────────────────────
const cors = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

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

// ── Main handler (routes by method + path) ────────────────────────────────────
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    // Preflight
    if (event.requestContext.http.method === 'OPTIONS') {
        return { statusCode: 204, headers: cors, body: '' };
    }

    const redis = await bootstrap();
    const method = event.requestContext.http.method;
    const path = event.rawPath; // e.g. /api/sessions or /api/sessions/{id}
    const id = event.pathParameters?.id;

    try {
        // GET /api/sessions
        if (method === 'GET' && !id) {
            const cached = await cacheGet<object[]>(redis, SESSIONS_CACHE_KEY);
            if (cached) return ok({ success: true, data: cached, source: 'cache' });

            const sessions = await Session.find().sort({ createdAt: -1 }).select('-__v').lean();
            const formatted = sessions.map((s: any) => ({
                id: s.sessionId,
                timestamp: s.createdAt,
                logs: s.logs,
                policySummary: s.policySummary,
            }));

            await cacheSet(redis, SESSIONS_CACHE_KEY, formatted, SESSIONS_TTL);
            return ok({ success: true, data: formatted, source: 'db' });
        }

        // POST /api/sessions — save session, enqueue summary job async
        if (method === 'POST' && !id) {
            const body = JSON.parse(event.body ?? '{}');
            const { id: sessionId, timestamp, logs, policySummary } = body;

            if (!sessionId || !Array.isArray(logs)) {
                return err('Missing required fields: id, logs');
            }

            const session = await Session.findOneAndUpdate(
                { sessionId },
                { sessionId, logs, policySummary: policySummary ?? '' },
                { upsert: true, new: true, runValidators: true }
            );

            // Invalidate cache
            await cacheDel(redis, SESSIONS_CACHE_KEY);

            // Enqueue async summary generation — do NOT await, return fast
            if (logs.length >= 2) {
                await sqsClient.send(new SendMessageCommand({
                    QueueUrl: SQS_QUEUE_URL,
                    MessageBody: JSON.stringify({ sessionId }),
                    MessageGroupId: 'summary',          // FIFO queue group
                    MessageDeduplicationId: sessionId,  // Idempotent
                }));
            }

            return ok({
                success: true,
                data: {
                    id: session.sessionId,
                    timestamp: session.createdAt,
                    logs: session.logs,
                    policySummary: session.policySummary,
                },
            }, 201);
        }

        // DELETE /api/sessions — clear all
        if (method === 'DELETE' && !id) {
            await Session.deleteMany({});
            await cacheDelPattern(redis, 'sessions:*');
            return ok({ success: true, message: 'All sessions cleared.' });
        }

        // DELETE /api/sessions/{id}
        if (method === 'DELETE' && id) {
            const result = await Session.findOneAndDelete({ sessionId: id });
            if (!result) return err('Session not found', 404);
            await cacheDel(redis, SESSIONS_CACHE_KEY);
            return ok({ success: true, message: 'Session deleted.' });
        }

        return err('Method not allowed', 405);

    } catch (e) {
        console.error('[Sessions] Handler error:', e);
        return err('Internal server error', 500);
    }
}
