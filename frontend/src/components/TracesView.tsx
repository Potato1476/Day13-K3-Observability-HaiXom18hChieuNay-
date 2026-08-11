import React, { useEffect, useState } from 'react';
import { GitCommit, ExternalLink, ShieldCheck, Tag, Layers } from 'lucide-react';

interface TracesState {
  ok: boolean;
  tracing_enabled: boolean;
  prompt_name: string;
  prompt_label: string;
  host: string;
}

export const TracesView: React.FC = () => {
  const [traceState, setTraceState] = useState<TracesState | null>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/traces')
      .then((res) => res.json())
      .then((data) => setTraceState(data))
      .catch((err) => console.error('Failed to fetch trace status', err));
  }, []);

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitCommit style={{ width: 20, height: 20, color: '#06b6d4' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>Langfuse Distributed Tracing & Prompt Management</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            End-to-end trace correlation with prompt versioning (day13-chat), user_id hashing, & span duration
          </p>
        </div>

        <a
          href={traceState?.host || 'https://cloud.langfuse.com'}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
        >
          Open Langfuse Cloud <ExternalLink style={{ width: 14, height: 14 }} />
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(9, 13, 22, 0.6)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            <ShieldCheck style={{ width: 16, height: 16, color: traceState?.tracing_enabled ? '#34d399' : '#f87171' }} /> Tracing Status
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            {traceState?.tracing_enabled ? 'Active (Langfuse SDK)' : 'Local Fallback Mode'}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {traceState?.tracing_enabled ? 'Exporting spans to Langfuse' : 'Set LANGFUSE_PUBLIC_KEY in .env'}
          </span>
        </div>

        <div style={{ background: 'rgba(9, 13, 22, 0.6)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            <Tag style={{ width: 16, height: 16, color: '#06b6d4' }} /> Prompt Name
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#06b6d4' }}>
            {traceState?.prompt_name || 'day13-chat'}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Managed prompt key</span>
        </div>

        <div style={{ background: 'rgba(9, 13, 22, 0.6)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            <Layers style={{ width: 16, height: 16, color: '#818cf8' }} /> Active Label / Version
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>
            {traceState?.prompt_label || 'production'}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Prompt release tag</span>
        </div>
      </div>

      <div style={{ background: 'rgba(9, 13, 22, 0.6)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>Trace Metadata & PII Protection Rules</h3>
        <ul style={{ listStyle: 'none', padding: 0, color: '#94a3b8', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>&bull; <strong style={{ color: '#cbd5e1' }}>Correlation ID:</strong> Injected per request via CorrelationIdMiddleware for cross-system trace matching.</li>
          <li>&bull; <strong style={{ color: '#cbd5e1' }}>User Hash:</strong> Raw user_id is hashed with SHA-256 (user_id_hash) before sending to Langfuse/logs.</li>
          <li>&bull; <strong style={{ color: '#cbd5e1' }}>Prompt Versioning:</strong> Resolves managed prompt v1/v2 with fallback handling.</li>
        </ul>
      </div>
    </div>
  );
};
