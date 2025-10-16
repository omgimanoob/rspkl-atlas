import { drizzle } from 'drizzle-orm/mysql2';
import { atlasPool } from '../../db';
import * as schema from './schema';

export const db = drizzle(atlasPool, { schema, mode: 'default' });
