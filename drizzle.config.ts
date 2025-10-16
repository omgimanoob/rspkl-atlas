import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.ATLAS_DB_HOST || 'localhost',
    user: process.env.ATLAS_DB_USER || 'root',
    password: process.env.ATLAS_DB_PASSWORD || '',
    database: process.env.ATLAS_DB_DATABASE || 'atlas',
    port: Number(process.env.ATLAS_DB_PORT || 3306),
  },
  verbose: true,
  strict: true,
});

