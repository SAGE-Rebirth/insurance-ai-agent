import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// ── Module-level cache (lives for the duration of the warm Lambda) ────────────
let cachedSecrets: Record<string, string> | null = null;

const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-south-1' });

/**
 * Fetch secrets from AWS Secrets Manager.
 * Cached in Lambda memory after first fetch — Secrets Manager is never
 * called more than once per warm invocation lifetime.
 *
 * @param secretName - The full Secrets Manager secret name/ARN
 */
export async function getSecrets(secretName: string): Promise<Record<string, string>> {
    if (cachedSecrets) return cachedSecrets;

    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (!response.SecretString) {
        throw new Error(`Secret "${secretName}" has no string value.`);
    }

    cachedSecrets = JSON.parse(response.SecretString) as Record<string, string>;
    console.log('[Secrets] Loaded from Secrets Manager (cold start)');
    return cachedSecrets;
}

/**
 * Convenience: get a single secret key.
 */
export async function getSecret(secretName: string, key: string): Promise<string> {
    const secrets = await getSecrets(secretName);
    const value = secrets[key];
    if (!value) throw new Error(`Secret key "${key}" not found in "${secretName}"`);
    return value;
}

// Reset cache (useful for testing)
export function resetSecretCache(): void {
    cachedSecrets = null;
}
