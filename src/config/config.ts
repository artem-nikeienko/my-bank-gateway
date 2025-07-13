import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
    host: string;
    nodeEnv: string;
    redisClientUrl: string;
}

const config: Config = {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'dev',
    redisClientUrl: process.env.REDIS_URL || "redis://localhost:6379"
}

export default config;