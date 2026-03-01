export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-surface-700/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {tabs.map(tab => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`tap-target flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary-400 scale-105'
                  : 'text-surface-500 hover:text-surface-300'
              }`}
            >
              <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary-400' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0 w-6 h-0.5 rounded-full bg-primary-400" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
