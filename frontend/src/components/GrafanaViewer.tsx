import React, { useState } from 'react';
import { ExternalLink, LayoutDashboard } from 'lucide-react';

export const GrafanaViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'grafana' | 'prometheus'>('grafana');

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard style={{ width: 22, height: 22, color: '#818cf8' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Grafana & Prometheus Live Stack</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            6 Contract Panels Provisioned: Latency, Traffic, Errors, Cost, Tokens, Quality
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href="http://localhost:3001/d/day13-ai-observability"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            Open Grafana <ExternalLink style={{ width: 14, height: 14 }} />
          </a>
          <a
            href="http://localhost:9090/targets"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            Open Prometheus <ExternalLink style={{ width: 14, height: 14 }} />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTab('grafana')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            color: activeTab === 'grafana' ? '#818cf8' : '#94a3b8',
            borderBottom: activeTab === 'grafana' ? '2px solid #818cf8' : 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Grafana Dashboard (3001)
        </button>
        <button
          onClick={() => setActiveTab('prometheus')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            color: activeTab === 'prometheus' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'prometheus' ? '2px solid #06b6d4' : 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Prometheus Targets (9090)
        </button>
      </div>

      {/* Content */}
      {activeTab === 'grafana' ? (
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: '650px', background: '#111827' }}>
          <iframe
            src="http://localhost:3001/d/day13-ai-observability/day-13-ai-observability?kiosk&refresh=5s"
            width="100%"
            height="100%"
            frameBorder="0"
            title="Grafana Dashboard"
          />
        </div>
      ) : (
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: '650px', background: '#111827' }}>
          <iframe
            src="http://localhost:9090/targets"
            width="100%"
            height="100%"
            frameBorder="0"
            title="Prometheus Targets"
          />
        </div>
      )}
    </div>
  );
};
