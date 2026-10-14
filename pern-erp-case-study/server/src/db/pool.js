import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.NODE_ENV === 'test'
    ? (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)
    : process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});
