import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Suppress dotenv info logs during tests and normal runs
dotenv.config({ quiet: true });

export const kimaiPool = mysql.createPool({
  host: process.env.KIMAI_DB_HOST,
  user: process.env.KIMAI_DB_USER,
  password: process.env.KIMAI_DB_PASSWORD,
  database: process.env.KIMAI_DB_DATABASE,
  port: Number(process.env.KIMAI_DB_PORT),
  timezone: 'Z',
});

export const atlasPool = mysql.createPool({
  host: process.env.ATLAS_DB_HOST,
  user: process.env.ATLAS_DB_USER,
  password: process.env.ATLAS_DB_PASSWORD,
  database: process.env.ATLAS_DB_DATABASE,
  port: Number(process.env.ATLAS_DB_PORT),
  timezone: 'Z',
});

// Ensure each session uses UTC timezone to avoid server/DB drift
// mysql2 pools emit a 'connection' event for newly established connections
;(kimaiPool as any).on?.('connection', (conn: any) => {
  try { conn.query("SET time_zone = '+00:00'"); } catch {}
});
;(atlasPool as any).on?.('connection', (conn: any) => {
  try { conn.query("SET time_zone = '+00:00'"); } catch {}
});
