// DeedFlow — PostgreSQL Schema Migration Runner
// Usage: node db/migrate.js
// Reads schema.sql and executes against Postgres, then seeds scoring_config defaults

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')
const { pool, query } = require('./index')

const SCORING_DEFAULTS = [
  ['taraweeh_per_rakaat', 1.5, 'Taraweeh per Rakaat', 'Points awarded per rakaat of Taraweeh prayer'],
  ['quran_per_para', 10, 'Quran per Para', 'Points per para (juz) read'],
  ['quran_per_khatam', 50, 'Quran per Khatam', 'Bonus points for completing a full Quran reading'],
  ['fasting_per_day', 15, 'Fasting per Day', 'Points per day of fasting'],
  ['azkar_per_session', 3, 'Azkar per Session', 'Points per morning or evening azkar session'],
  ['surah_per_ayah', 0.5, 'Surah per Ayah', 'Points per ayah memorized'],
  ['namaz_mosque', 4, 'Namaz Mosque', 'Points per prayer at mosque'],
  ['namaz_home_men', 2, 'Namaz Home (Men)', 'Points per prayer at home for men'],
  ['namaz_home_women', 4, 'Namaz Home (Women)', 'Points per prayer at home for women'],
  ['streak_per_day', 2, 'Streak per Day', 'Points per consecutive day streak'],
]

async function migrate() {
  console.log('[MIGRATE] Starting schema migration...')
  console.log(`[MIGRATE] Target: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':****@')}`)

  try {
    // 1. Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8')

    await query(schemaSql)
    console.log('[MIGRATE] Schema created/verified (all tables)')

    // 2. Seed scoring_config defaults (only if table is empty)
    const { rows } = await query('SELECT COUNT(*) AS count FROM scoring_config')
    const count = parseInt(rows[0].count, 10)

    if (count === 0) {
      const insertSql = `
        INSERT INTO scoring_config (key, value, label, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO NOTHING
      `
      for (const [key, value, label, desc] of SCORING_DEFAULTS) {
        await query(insertSql, [key, value, label, desc])
      }
      console.log(`[MIGRATE] Seeded ${SCORING_DEFAULTS.length} scoring_config defaults`)
    } else {
      console.log(`[MIGRATE] scoring_config already has ${count} rows — skipping seed`)
    }

    // 3. List all tables for verification
    const tables = await query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    console.log(`[MIGRATE] Tables in database (${tables.rows.length}):`)
    tables.rows.forEach(r => console.log(`  - ${r.tablename}`))

    console.log('[MIGRATE] ✅ Migration complete')
  } catch (err) {
    console.error('[MIGRATE] ❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
