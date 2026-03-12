const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const useSsl = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';
const databaseUrl = (process.env.DATABASE_URL || '').trim();

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});
//test
module.exports = pool;
