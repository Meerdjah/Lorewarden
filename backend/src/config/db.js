const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB       || 'lorewarden',
  user:     process.env.POSTGRES_USER     || 'lorewarden_user',
  password: process.env.POSTGRES_PASSWORD || 'lorewarden_pass',
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

module.exports = pool;
