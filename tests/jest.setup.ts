process.env.NODE_ENV = 'test';
if (!process.env.PORT) {
  process.env.PORT = '9999';
}

// Ensure DB pools are closed after tests to prevent open handle leaks
import { atlasPool, kimaiPool } from '../db';

afterAll(async () => {
  try { await atlasPool.end(); } catch {}
  try { await kimaiPool.end(); } catch {}
});
