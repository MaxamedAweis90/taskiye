import { useState, useEffect } from 'react';
import { CheckCircle2, Calendar, Flame, Target, Settings, Server, RefreshCw } from 'lucide-react';

export function App() {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<string>('');

  const checkHealth = async () => {
    setServerStatus('checking');
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerStatus('online');
        setServerInfo(`${data.app} is running (${data.status})`);
      } else {
        setServerStatus('offline');
        setServerInfo('Server responded with an error');
      }
    } catch {
      setServerStatus('offline');
      setServerInfo('Could not connect to /api/health');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            T
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Taskiye</h1>
          <span
            style={{
              fontSize: '0.75rem',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--accent-primary)',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontWeight: 600,
            }}
          >
            V1 MVP
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <Server size={16} />
            <span>Backend:</span>
            <span
              style={{
                color:
                  serverStatus === 'online'
                    ? '#22c55e'
                    : serverStatus === 'offline'
                      ? '#ef4444'
                      : '#eab308',
                fontWeight: 600,
              }}
            >
              {serverStatus.toUpperCase()}
            </span>
            <button
              onClick={checkHealth}
              title="Refresh health check"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '0.25rem',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar Preview */}
        <aside
          style={{
            width: 240,
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--accent-primary)',
              fontWeight: 600,
            }}
          >
            <Calendar size={18} />
            <span>Today's Board</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            <Flame size={18} />
            <span>Habits</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            <Target size={18} />
            <span>Goals</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </div>
        </aside>

        {/* Workspace Canvas */}
        <main style={{ flex: 1, padding: '2.5rem', maxWidth: 1000 }}>
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              marginBottom: '2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <CheckCircle2 color="#eab308" size={28} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Monorepo Baseline Ready</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              The Taskiye monorepo structure has been initialized with TypeScript, Express API server,
              Vite + React client, Prettier, and ESLint.
            </p>

            {/* Heatmap Preview Visual */}
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Heatmap Completion Legend Preview
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: 'var(--accent-yellow-default)' }} title="0% - 10%" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '1rem' }}>0-10%</span>
                <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: 'var(--accent-yellow-low)' }} title="11% - 50%" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '1rem' }}>11-50%</span>
                <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: 'var(--accent-yellow-mid)' }} title="51% - 99%" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '1rem' }}>51-99%</span>
                <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: 'var(--accent-yellow-high)' }} title="100%" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>100% (Solid)</span>
              </div>
            </div>

            {serverInfo && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '0.8rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Status details: {serverInfo}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
