import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { seed } from './seed.js';
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const sql = await fs.readFile(path.join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
  await seed(pool);
  console.log('Database schema and seed data ready.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
