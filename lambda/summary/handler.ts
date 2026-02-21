import { SQSEvent, SQSRecord } from 'aws-lambda';
import { connectDB, Session } from '../shared/db';
import { getRedis, cacheDel } from '../shared/redis';
import { getSecrets } from '../shared/secrets';

const SECRET_NAME = process.env.SECRET_NAME!;
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
    const secrets = await getSecrets(SECRET_NAME);
    await connectDB(secrets.MONGODB_URI);
    const redis = getRedis(secrets.REDIS_URL);
    return { redis, geminiKey: secrets.GEMINI_API_KEY };
}

// ── AI Summary via Gemini REST API ───────────────────────────────────────────
async function generateSummary(transcript: string, geminiKey: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

    const body = {
        contents: [{
            parts: [{
                text: `Summarize the following insurance agent conversation in 2-3 concise sentences:\n\n${transcript}`,
            }],
        }],
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Summary not available.';
}

// ── Process one SQS record ───────────────────────────────────────────────────
async function processRecord(record: SQSRecord, geminiKey: string, redis: any): Promise<void> {
    const { sessionId } = JSON.parse(record.body) as { sessionId: string };

    const session = await Session.findOne({ sessionId }).lean() as any;
    if (!session) {
        console.warn(`[Summary] Session not found: ${sessionId}`);
        return;
    }

    // Build transcript (skip system messages)
    const transcript = session.logs
        .filter((l: any) => l.role !== 'system')
        .map((l: any) => `${l.role.toUpperCase()}: ${l.message}`)
        .join('\n');

    if (!transcript.trim()) {
        console.warn(`[Summary] Empty transcript for session: ${sessionId}`);
        return;
    }

    const summary = await generateSummary(transcript, geminiKey);

    // Update MongoDB
    await Session.updateOne({ sessionId }, { $set: { policySummary: summary } });

    // Invalidate cache so next GET picks up the updated summary
    await cacheDel(redis, 'sessions:all');

    console.log(`[Summary] ✅ Generated summary for session: ${sessionId}`);
}

// ── Main handler — processes a batch of SQS records ─────────────────────────
export async function handler(event: SQSEvent): Promise<void> {
    const { redis, geminiKey } = await bootstrap();

    // Process records concurrently but limited (SQS batch size = 1 in SAM template)
    await Promise.allSettled(
        event.Records.map((record) =>
            processRecord(record, geminiKey, redis).catch((err) => {
                // Log but don't throw — failed records returned to queue for retry
                console.error(`[Summary] Failed for record: ${record.messageId}`, err);
                throw err; // Re-throw so SQS knows to retry this specific record
            })
        )
    );
}
