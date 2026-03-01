// DeedFlow — Express Server (Phase 0 scaffold)

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
const db = require('./db')

const app = express()
const PORT = process.env.PORT || 3001

// ===================================================================
// MIDDLEWARE
// ===================================================================

app.use(helmet({
  contentSecurityPolicy: false, // Will configure properly in Phase 7
}))

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'https://myramadan.duckdns.org'
    : 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting — general API (relaxed for dev, tighten in Phase 7)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
app.use('/api', apiLimiter)

// ===================================================================
// HEALTH CHECK
// ===================================================================

app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS time')
    res.json({
      status: 'ok',
      version: '4.0.0-dev',
      time: result.rows[0].time,
      uptime: Math.floor(process.uptime()),
    })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
    })
  }
})

// ===================================================================
// ROUTE STUBS (Phase 1+)
// ===================================================================

// app.use('/api/auth', require('./routes/auth'))
// app.use('/api/dashboard', require('./routes/dashboard'))
// app.use('/api/taraweeh', require('./routes/taraweeh'))
// app.use('/api/quran', require('./routes/quran'))
// app.use('/api/fasting', require('./routes/fasting'))
// app.use('/api/azkar', require('./routes/azkar'))
// app.use('/api/surah', require('./routes/surah'))
// app.use('/api/namaz', require('./routes/namaz'))
// app.use('/api/ramadan', require('./routes/ramadan'))
// app.use('/api/analytics', require('./routes/analytics'))
// app.use('/api/admin', require('./routes/admin'))

// ===================================================================
// PRODUCTION: Serve React build
// ===================================================================

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ===================================================================
// ERROR HANDLER
// ===================================================================

app.use((err, req, res, _next) => {
  console.error('[SERVER] Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ===================================================================
// START
// ===================================================================

app.listen(PORT, () => {
  console.log(`[SERVER] DeedFlow v4.0.0-dev listening on port ${PORT}`)
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`)
})

module.exports = app
