import React, { useEffect, useState } from 'react';
import { FileText, Search, RefreshCw } from 'lucide-react';

interface LogEntry {
  ts?: string;
  service?: string;
  event?: string;
  level?: string;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  quality_score?: number;
  payload?: {
    message_preview?: string;
    answer_preview?: string;
    detail?: string;
    tracing_enabled?: boolean;
  };
}

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/logs?limit=50');
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const event = log.event?.toLowerCase() || '';
    const service = log.service?.toLowerCase() || '';
    const preview = log.payload?.message_preview?.toLowerCase() || log.payload?.answer_preview?.toLowerCase() || '';
    return event.includes(term) || service.includes(term) || preview.includes(term);
  });

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText style={{ width: 20, height: 20, color: '#06b6d4' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>Structured JSONL Logs Explorer</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            Real-time API log stream from data/logs.jsonl with correlation ID context & PII redaction
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.4rem 0.8rem 0.4rem 2rem',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
                width: '200px'
              }}
            />
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            title="Refresh logs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              cursor: loading ? 'not-allowed' : 'pointer',
              pointerEvents: 'auto'
            }}
          >
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(9, 13, 22, 0.6)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Timestamp</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Level</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Event</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Service</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Payload / Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No log entries found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((item, i) => {
                const isErr = item.level === 'error' || item.event === 'request_failed';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '0.6rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {item.ts ? item.ts.split('T')[1]?.replace('Z', '') : '--:--:--'}
                    </td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: isErr ? 'rgba(244,63,94,0.15)' : 'rgba(6,182,212,0.15)',
                          color: isErr ? '#f87171' : '#06b6d4'
                        }}
                      >
                        {item.level || 'info'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', color: '#cbd5e1', fontWeight: 500 }}>
                      {item.event}
                    </td>
                    <td style={{ padding: '0.6rem 1rem', color: '#818cf8' }}>
                      {item.service}
                    </td>
                    <td style={{ padding: '0.6rem 1rem', color: '#94a3b8', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.payload?.message_preview || item.payload?.answer_preview || item.payload?.detail || JSON.stringify(item.payload || {})}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
