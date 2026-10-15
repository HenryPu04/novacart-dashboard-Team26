import React, { useEffect, useState } from 'react';
import { getHealth } from '../utils/api';

const REFRESH_MS = 300000;

// 3725 → "1h 2m", 95 → "1m 35s"
function formatUptime(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function DetailRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color || 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function ServiceStatus() {
  const [status,      setStatus]      = useState('checking');
  const [health,      setHealth]      = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [checking,    setChecking]    = useState(false);
  const [open,        setOpen]        = useState(false);

  async function check() {
    setChecking(true);
    try {
      const data = await getHealth();
      setHealth(data);
      setStatus(data.status === 'healthy' ? 'healthy' : 'degraded');
    } catch {
      setHealth(null);
      setStatus('error');
    } finally {
      setLastChecked(new Date());
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
    const interval = setInterval(check, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const colors = { healthy: '#00897B', degraded: '#F9A825', error: '#C62828', checking: '#90A4AE' };
  const labels = { healthy: 'Service healthy', degraded: 'Degraded', error: 'Offline', checking: 'Checking…' };

  const dbConnected = health?.database?.status === 'connected';
  const dbLabel = status === 'checking' ? 'Checking…'
                : status === 'error'    ? 'Unknown'
                : dbConnected           ? 'Connected' : 'Not connected';
  const dbColor = status === 'checking' || status === 'error' ? undefined
                : dbConnected ? colors.healthy : colors.error;

  return (
    <div style={{ position: 'relative' }}
         onMouseEnter={() => setOpen(true)}
         onMouseLeave={() => setOpen(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'default' }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: colors[status],
          boxShadow: status === 'healthy' ? `0 0 6px ${colors[status]}` : 'none',
          display: 'inline-block',
        }} />
        <span style={{ color: colors[status], fontWeight: 500 }}>{labels[status]}</span>
      </div>

      {/* Hover window — paddingTop (not margin) bridges the gap so moving the mouse onto it keeps it open */}
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 10, zIndex: 200 }}>
          <div style={{
            width: 240, padding: '12px 14px', fontSize: 13,
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Service Status</div>
            <DetailRow label="API"
                       value={status === 'error' ? 'Unreachable' : status === 'checking' ? 'Checking…' : 'Reachable'}
                       color={status === 'error' ? colors.error : status === 'checking' ? undefined : colors.healthy} />
            <DetailRow label="Database" value={dbLabel} color={dbColor} />
            {health?.backend && (
              <DetailRow label="Data source" value={health.backend === 'snowflake' ? 'Snowflake' : 'SQLite (local)'} />
            )}
            {health?.uptime_s != null && <DetailRow label="Uptime" value={formatUptime(health.uptime_s)} />}
            <DetailRow label="Last checked" value={lastChecked ? lastChecked.toLocaleTimeString() : '—'} />

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text-muted)',
            }}>
              <span>Auto-refresh every {REFRESH_MS / 1000}s</span>
              <button onClick={check} disabled={checking}
                style={{
                  background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600,
                  color: 'var(--accent)', cursor: checking ? 'default' : 'pointer', opacity: checking ? 0.6 : 1,
                }}>
                {checking ? 'Checking…' : 'Check now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
