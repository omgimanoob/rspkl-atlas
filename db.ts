import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const kimaiPool = mysql.createPool({
  host: process.env.KIMAI_DB_HOST,
  user: process.env.KIMAI_DB_USER,
  password: process.env.KIMAI_DB_PASSWORD,
  database: process.env.KIMAI_DB_DATABASE,
  port: Number(process.env.KIMAI_DB_PORT),
});

export const atlasPool = mysql.createPool({
  host: process.env.ATLAS_DB_HOST,
  user: process.env.ATLAS_DB_USER,
  password: process.env.ATLAS_DB_PASSWORD,
  database: process.env.ATLAS_DB_DATABASE,
  port: Number(process.env.ATLAS_DB_PORT),
});
