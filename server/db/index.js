// DeedFlow — PostgreSQL connection pool
// Usage: const db = require('./db'); db.query('SELECT ...', [params])

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings tuned for Raspberry Pi
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Log connection status
pool.on('connect', () => {
  console.log('[DB] Client connected to PostgreSQL')
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message)
})

/**
 * Run a parameterized query
 * @param {string} text - SQL query with $1, $2, ... placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start
  if (duration > 500) {
    console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 80)}...`)
  }
  return result
}

/**
 * Get a client from the pool (for transactions)
 * Remember to call client.release() when done
 */
async function getClient() {
  return pool.connect()
}

module.exports = { query, getClient, pool }
