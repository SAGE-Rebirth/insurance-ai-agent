import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(5000),
    MONGODB_URI: Joi.string().uri().required(),
    REDIS_URL: Joi.string().required(),
    GEMINI_API_KEY: Joi.string().required(),
    CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Environment validation failed: ${error.message}\nCheck your .env file.`);
}

export const config = {
    nodeEnv: envVars.NODE_ENV as string,
    port: envVars.PORT as number,
    mongoUri: envVars.MONGODB_URI as string,
    redisUrl: envVars.REDIS_URL as string,
    geminiApiKey: envVars.GEMINI_API_KEY as string,
    corsOrigin: envVars.CORS_ORIGIN as string,
    isProd: envVars.NODE_ENV === 'production',
};
