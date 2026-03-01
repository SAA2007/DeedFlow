import { useState } from 'react'
import BottomNav from './components/BottomNav.jsx'

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'prayers', label: 'Prayers', icon: '🕌' },
  { id: 'quran', label: 'Quran', icon: '📖' },
  { id: 'deeds', label: 'Deeds', icon: '✨' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Main content area */}
      <main className="flex-1 px-4 pt-6 pb-4 max-w-lg mx-auto w-full">
        <HeroSection />
        <QuickActions />
        <PlaceholderContent tab={activeTab} />
      </main>

      {/* Bottom navigation */}
      <BottomNav tabs={TABS} active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

/* ============================================================
   Hero Section — branded landing
   ============================================================ */
function HeroSection() {
  return (
    <div className="text-center mb-8">
      {/* Animated gradient logo */}
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25 mb-4 animate-pulse">
        <span className="text-4xl">☪</span>
      </div>

      <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
        DeedFlow
      </h1>
      <p className="text-surface-400 mt-1 text-sm">
        Your family's Islamic good deeds companion
      </p>

      {/* Version badge */}
      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass text-xs text-surface-300">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
        v4.0.0-dev · Phase 0
      </div>
    </div>
  )
}

/* ============================================================
   Quick Actions — one-tap logging stubs
   ============================================================ */
function QuickActions() {
  const actions = [
    { emoji: '🤲', label: 'Log Prayer',   color: 'from-emerald-600 to-emerald-800' },
    { emoji: '📖', label: 'Read Quran',   color: 'from-sky-600 to-sky-800' },
    { emoji: '🌙', label: 'Log Fast',     color: 'from-violet-600 to-violet-800' },
    { emoji: '📿', label: 'Dhikr',        color: 'from-amber-600 to-amber-800' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {actions.map(a => (
        <button
          key={a.label}
          className={`tap-target flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-br ${a.color} text-white font-medium text-sm shadow-lg transition-transform active:scale-[0.97] hover:brightness-110`}
        >
          <span className="text-xl">{a.emoji}</span>
          {a.label}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   Placeholder tab content
   ============================================================ */
function PlaceholderContent({ tab }) {
  return (
    <div className="glass rounded-2xl p-6 text-center">
      <p className="text-surface-400 text-sm">
        <span className="text-lg block mb-2">🚧</span>
        <span className="font-semibold text-surface-200 capitalize">{tab}</span> tab — coming in Phase 1
      </p>
    </div>
  )
}
