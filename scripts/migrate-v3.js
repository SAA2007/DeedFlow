#!/usr/bin/env node

// ===================================================================
// DeedFlow — RamadanFlow v3 SQLite → PostgreSQL Migration Script
// ===================================================================
//
// Usage:
//   node migrate-v3.js --sqlite /path/to/ramadanflow.db
//
// Environment:
//   DATABASE_URL=postgresql://deedflow_user:password@localhost:5432/deedflow
//
// This script reads all data from the RamadanFlow v3 SQLite database
// and inserts it into the DeedFlow PostgreSQL database.
// Run server/db/migrate.js FIRST to create the schema.
// ===================================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') })

const Database = require('better-sqlite3')
const { Pool } = require('pg')
const path = require('path')

// ===================================================================
// CLI args
// ===================================================================

const args = process.argv.slice(2)
const sqliteFlag = args.indexOf('--sqlite')
const SQLITE_PATH = sqliteFlag !== -1 ? args[sqliteFlag + 1] : null

if (!SQLITE_PATH) {
  console.error('Usage: node migrate-v3.js --sqlite /path/to/ramadanflow.db')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

// ===================================================================
// Connections
// ===================================================================

const sqlite = new Database(SQLITE_PATH, { readonly: true })
const pg = new Pool({ connectionString: process.env.DATABASE_URL })

// ===================================================================
// Helper — batch insert with ON CONFLICT DO NOTHING
// ===================================================================

async function migrateTable(tableName, selectSql, insertSql, mapRow) {
  const rows = sqlite.prepare(selectSql).all()
  if (rows.length === 0) {
    console.log(`  [${tableName}] 0 rows — skipping`)
    return 0
  }

  const client = await pg.connect()
  try {
    await client.query('BEGIN')

    let inserted = 0
    for (const row of rows) {
      try {
        const params = mapRow(row)
        await client.query(insertSql, params)
        inserted++
      } catch (err) {
        if (err.code === '23505') {
          // Unique constraint violation — skip duplicate
          continue
        }
        throw err
      }
    }

    await client.query('COMMIT')
    console.log(`  [${tableName}] ${inserted}/${rows.length} rows migrated`)
    return inserted
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`  [${tableName}] ❌ FAILED:`, err.message)
    throw err
  } finally {
    client.release()
  }
}

// ===================================================================
// Date conversion helper (SQLite TEXT → Postgres DATE/TIMESTAMPTZ)
// ===================================================================

function toDate(val) {
  if (!val) return null
  // SQLite stores as 'YYYY-MM-DD' or ISO string
  return val.substring(0, 10)
}

function toTimestamp(val) {
  if (!val) return null
  // SQLite datetime('now') format: 'YYYY-MM-DD HH:MM:SS'
  return val
}

// ===================================================================
// MIGRATION
// ===================================================================

async function main() {
  console.log('='.repeat(60))
  console.log('DeedFlow — v3 SQLite → PostgreSQL Migration')
  console.log('='.repeat(60))
  console.log(`SQLite: ${SQLITE_PATH}`)
  console.log(`Postgres: ${process.env.DATABASE_URL.replace(/:[^@]+@/, ':****@')}`)
  console.log()

  const totals = {}

  // ---------------------------------------------------------------
  // 1. USERS (drop plain_pw — not migrated for security)
  // ---------------------------------------------------------------
  totals.users = await migrateTable(
    'users',
    'SELECT * FROM users',
    `INSERT INTO users (id, username, email, password_hash, role, gender, age, dob, score_multiplier, session_invalidated_at, frozen, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    (r) => [
      r.id,
      r.username,
      r.email,
      r.password_hash,
      r.role || 'user',
      r.gender || 'Male',
      r.age || 30,
      toDate(r.dob),
      r.score_multiplier || 1.0,
      toTimestamp(r.session_invalidated_at),
      r.frozen ? true : false,
      toTimestamp(r.created_at),
    ]
  )

  // Reset Postgres SERIAL sequence to max id
  await pg.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))`)

  // ---------------------------------------------------------------
  // 2. TARAWEEH
  // ---------------------------------------------------------------
  totals.taraweeh = await migrateTable(
    'taraweeh',
    'SELECT * FROM taraweeh',
    `INSERT INTO taraweeh (id, username, year, date, completed, rakaat)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.username, r.year, toDate(r.date), r.completed, r.rakaat]
  )
  await pg.query(`SELECT setval('taraweeh_id_seq', (SELECT COALESCE(MAX(id), 1) FROM taraweeh))`)

  // ---------------------------------------------------------------
  // 3. KHATAMS (TEXT primary key — no seq reset needed)
  // ---------------------------------------------------------------
  totals.khatams = await migrateTable(
    'khatams',
    'SELECT * FROM khatams',
    `INSERT INTO khatams (id, username, year, type, started_at, completed_at, para_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.username, r.year, r.type, toTimestamp(r.started_at), toTimestamp(r.completed_at), r.para_count]
  )

  // ---------------------------------------------------------------
  // 4. QURAN_PROGRESS
  // ---------------------------------------------------------------
  totals.quran_progress = await migrateTable(
    'quran_progress',
    'SELECT * FROM quran_progress',
    `INSERT INTO quran_progress (id, khatam_id, para_number, completed, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.khatam_id, r.para_number, r.completed ? true : false, toTimestamp(r.updated_at)]
  )
  await pg.query(`SELECT setval('quran_progress_id_seq', (SELECT COALESCE(MAX(id), 1) FROM quran_progress))`)

  // ---------------------------------------------------------------
  // 5. FASTING
  // ---------------------------------------------------------------
  totals.fasting = await migrateTable(
    'fasting',
    'SELECT * FROM fasting',
    `INSERT INTO fasting (id, username, year, date, completed)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.username, r.year, toDate(r.date), r.completed]
  )
  await pg.query(`SELECT setval('fasting_id_seq', (SELECT COALESCE(MAX(id), 1) FROM fasting))`)

  // ---------------------------------------------------------------
  // 6. SETTINGS
  // ---------------------------------------------------------------
  totals.settings = await migrateTable(
    'settings',
    'SELECT * FROM settings',
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    (r) => [r.key, r.value]
  )

  // ---------------------------------------------------------------
  // 7. AZKAR
  // ---------------------------------------------------------------
  totals.azkar = await migrateTable(
    'azkar',
    'SELECT * FROM azkar',
    `INSERT INTO azkar (id, username, date, morning, evening)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.username, toDate(r.date), r.morning, r.evening]
  )
  await pg.query(`SELECT setval('azkar_id_seq', (SELECT COALESCE(MAX(id), 1) FROM azkar))`)

  // ---------------------------------------------------------------
  // 8. SURAH_MEMORIZATION
  // ---------------------------------------------------------------
  totals.surah_memorization = await migrateTable(
    'surah_memorization',
    'SELECT * FROM surah_memorization',
    `INSERT INTO surah_memorization (id, username, surah_number, surah_name, total_ayah, memorized_ayah, started_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.username, r.surah_number, r.surah_name, r.total_ayah, r.memorized_ayah, toTimestamp(r.started_at), toTimestamp(r.completed_at)]
  )
  await pg.query(`SELECT setval('surah_memorization_id_seq', (SELECT COALESCE(MAX(id), 1) FROM surah_memorization))`)

  // ---------------------------------------------------------------
  // 9. NAMAZ
  // ---------------------------------------------------------------
  totals.namaz = await migrateTable(
    'namaz',
    'SELECT * FROM namaz',
    `INSERT INTO namaz (id, username, date, prayer, location)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.username, toDate(r.date), r.prayer, r.location]
  )
  await pg.query(`SELECT setval('namaz_id_seq', (SELECT COALESCE(MAX(id), 1) FROM namaz))`)

  // ---------------------------------------------------------------
  // 10. RAMADAN_DATES
  // ---------------------------------------------------------------
  totals.ramadan_dates = await migrateTable(
    'ramadan_dates',
    'SELECT * FROM ramadan_dates',
    `INSERT INTO ramadan_dates (id, year, region, date, set_by_admin, note, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    (r) => [r.id, r.year, r.region, toDate(r.date), r.set_by_admin ? true : false, r.note, toTimestamp(r.updated_at)]
  )
  await pg.query(`SELECT setval('ramadan_dates_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ramadan_dates))`)

  // ---------------------------------------------------------------
  // 11. SCORING_CONFIG
  // ---------------------------------------------------------------
  totals.scoring_config = await migrateTable(
    'scoring_config',
    'SELECT * FROM scoring_config',
    `INSERT INTO scoring_config (key, value, label, description)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, label = EXCLUDED.label, description = EXCLUDED.description`,
    (r) => [r.key, r.value, r.label, r.description]
  )

  // ---------------------------------------------------------------
  // 12–17. ANALYTICS TABLES
  // ---------------------------------------------------------------
  const analyticsTables = [
    {
      name: 'analytics_events',
      select: 'SELECT * FROM analytics_events',
      insert: `INSERT INTO analytics_events (id, session_id, user_id, username, event_type, event_data, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      map: (r) => [r.id, r.session_id, r.user_id, r.username, r.event_type, r.event_data, toTimestamp(r.created_at)],
    },
    {
      name: 'analytics_fingerprints',
      select: 'SELECT * FROM analytics_fingerprints',
      insert: `INSERT INTO analytics_fingerprints (id, session_id, user_id, username, fingerprint_hash, canvas_hash, webgl_hash, webrtc_ips, navigator_data, timezone, locale, color_scheme, screen_resolution, headless_flags, ja3_hash, cf_ip_country, cf_device_type, cf_connecting_ip_hash, user_agent, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT DO NOTHING`,
      map: (r) => [r.id, r.session_id, r.user_id, r.username, r.fingerprint_hash, r.canvas_hash, r.webgl_hash, r.webrtc_ips, r.navigator_data, r.timezone, r.locale, r.color_scheme, r.screen_resolution, r.headless_flags, r.ja3_hash, r.cf_ip_country, r.cf_device_type, r.cf_connecting_ip_hash, r.user_agent, toTimestamp(r.created_at)],
    },
    {
      name: 'analytics_typing_profiles',
      select: 'SELECT * FROM analytics_typing_profiles',
      insert: `INSERT INTO analytics_typing_profiles (id, username, session_id, avg_dwell_ms, avg_flight_ms, baseline_dwell, baseline_flight, deviation_pct, flagged, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      map: (r) => [r.id, r.username, r.session_id, r.avg_dwell_ms, r.avg_flight_ms, r.baseline_dwell, r.baseline_flight, r.deviation_pct, r.flagged ? true : false, toTimestamp(r.created_at)],
    },
    {
      name: 'analytics_anomalies',
      select: 'SELECT * FROM analytics_anomalies',
      insert: `INSERT INTO analytics_anomalies (id, session_id, user_id, username, severity, anomaly_type, details, ip_hash, cf_ip_country, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      map: (r) => [r.id, r.session_id, r.user_id, r.username, r.severity, r.anomaly_type, r.details, r.ip_hash, r.cf_ip_country, toTimestamp(r.created_at)],
    },
    {
      name: 'analytics_admin_audit',
      select: 'SELECT * FROM analytics_admin_audit',
      insert: `INSERT INTO analytics_admin_audit (id, admin_username, action, target_username, before_state, after_state, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      map: (r) => [r.id, r.admin_username, r.action, r.target_username, r.before_state, r.after_state, toTimestamp(r.created_at)],
    },
    {
      name: 'analytics_honeypot',
      select: 'SELECT * FROM analytics_honeypot',
      insert: `INSERT INTO analytics_honeypot (id, session_id, ip_hash, route, user_agent, headers, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      map: (r) => [r.id, r.session_id, r.ip_hash, r.route, r.user_agent, r.headers, toTimestamp(r.created_at)],
    },
  ]

  for (const t of analyticsTables) {
    try {
      totals[t.name] = await migrateTable(t.name, t.select, t.insert, t.map)
      // Reset sequences
      await pg.query(`SELECT setval('${t.name}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${t.name}))`)
    } catch (err) {
      totals[t.name] = `ERROR: ${err.message}`
    }
  }

  // analytics_requests — skip (ephemeral data, not worth migrating)
  console.log('  [analytics_requests] Skipped (ephemeral request log)')
  totals.analytics_requests = 'skipped'

  // ---------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------
  console.log()
  console.log('='.repeat(60))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(60))
  for (const [table, count] of Object.entries(totals)) {
    console.log(`  ${table.padEnd(30)} ${count}`)
  }
  console.log('='.repeat(60))
  console.log('✅ Migration complete!')

  sqlite.close()
  await pg.end()
}

main().catch((err) => {
  console.error('Fatal migration error:', err)
  process.exit(1)
})
