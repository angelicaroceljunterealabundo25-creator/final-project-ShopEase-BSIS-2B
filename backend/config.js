import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

dotenv.config({ path: fileURLToPath(new URL('./.env.local', import.meta.url)), quiet: true });

export const production = process.env.NODE_ENV === 'production';
export const host = process.env.HOST || '127.0.0.1';
export const port = Number(process.env.PORT || 35174);
export const appOrigin = process.env.APP_ORIGIN || `http://${host}:${port}`;
export const dataDirectory = fileURLToPath(new URL('./.data/', import.meta.url));
export const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
export const mongoUri = process.env.MONGO_URI;
export const mongoDbName = process.env.MONGO_DB_NAME || 'shopease';
export const seedDemo = !production && process.env.SEED_DEMO !== 'false';
export const mapKey = process.env.GOOGLE_MAPS_EMBED_KEY || '';
export const googleMapsDemoKey = production ? '' : (process.env.GOOGLE_MAPS_DEMO_KEY || '').trim();

if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.APP_ORIGIN)) {
  throw new Error('Production requires JWT_SECRET (32 characters minimum) and APP_ORIGIN.');
}
