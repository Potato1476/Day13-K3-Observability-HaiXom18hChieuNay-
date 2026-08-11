import React, { useCallback, useEffect, useState } from 'react';
import { Flame, ShieldAlert, DollarSign, RefreshCw, ShieldCheck, Activity } from 'lucide-react';

const API = 'http://127.0.0.1:8000';

type IncidentName = 'rag_slow' | 'tool_fail' | 'cost_spike';

interface Scenario {
  name: IncidentName;
  title: string;
  injectedAt: string;
  symptom: string;
  panel: string;
  icon: React.ReactNode;
  tone: string;
}

/** Ba kịch bản practice trong app/incidents.py, kèm triệu chứng mong đợi trên dashboard. */
const SCENARIOS: Scenario[] = [
  {
    name: 'rag_slow',
    title: 'RAG Slow',
    injectedAt: 'mock_rag.retrieve ngủ thêm 2.5s',
    symptom: 'P95 latency vượt ngưỡng 3s, traffic không đổi',
    panel: 'latency',
    icon: <Flame style={{ width: 14, height: 14 }} />,
    tone: '#fb923c',
  },
  {
    name: 'tool_fail',
    title: 'Tool Fail',
    injectedAt: 'mock_rag.retrieve raise RuntimeError',
    symptom: 'error rate tăng, ai_errors_total{error_type="RuntimeError"}',
    panel: 'errors',
    icon: <ShieldAlert style={{ width: 14, height: 14 }} />,
    tone: '#f87171',
  },
  {
    name: 'cost_spike',
    title: 'Cost Spike',
    injectedAt: 'mock_llm nhân 4 số output token',
    symptom: 'cost và tokens tăng trong khi traffic phẳng',
    panel: 'cost / tokens',
    icon: <DollarSign style={{ width: 14, height: 14 }} />,
    tone: '#fbbf24',
  },
];

export const IncidentPanel: React.FC<{ onChange?: () => void }> = ({ onChange }) => {
  const [incidents, setIncidents] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/incidents`);
      const data = await res.json();
      setIncidents(data.incidents ?? {});
      setError(null);
    } catch {
      setError('Không đọc được trạng thái incident từ API.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const toggle = async (name: IncidentName) => {
    const action = incidents[name] ? 'disable' : 'enable';
    setBusy(name);
    try {
      await fetch(`${API}/incidents/${name}/${action}`, { method: 'POST' });
      await load();
      onChange?.();
    } catch {
      setError(`Không ${action} được incident ${name}.`);
    } finally {
      setBusy(null);
    }
  };

  const disableAll = async () => {
    setBusy('all');
    try {
      await Promise.all(
        SCENARIOS.filter((s) => incidents[s.name]).map((s) =>
          fetch(`${API}/incidents/${s.name}/disable`, { method: 'POST' }),
        ),
      );
      await load();
      onChange?.();
    } catch {
      setError('Không tắt được toàn bộ incident.');
    } finally {
      setBusy(null);
    }
  };

  const activeCount = SCENARIOS.filter((s) => incidents[s.name]).length;

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity style={{ width: 22, height: 22, color: '#f87171' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Incident Injection</h2>
            <span
              className={activeCount > 0 ? 'badge badge-danger' : 'badge badge-success'}
              style={{
                background: activeCount > 0 ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                color: activeCount > 0 ? '#f87171' : '#34d399',
              }}
            >
              {activeCount > 0 ? `${activeCount} đang bật` : 'hệ thống bình thường'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Ba kịch bản practice, tương đương <code>scripts/inject_incident.py --scenario &lt;tên&gt;</code>.
            Trạng thái đọc trực tiếp từ API nên luôn khớp với server.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={() => void load()}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button
            onClick={() => void disableAll()}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            disabled={activeCount === 0 || busy !== null}
          >
            <ShieldCheck style={{ width: 14, height: 14 }} /> Tắt tất cả
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {SCENARIOS.map((scenario) => {
          const active = Boolean(incidents[scenario.name]);
          return (
            <div
              key={scenario.name}
              style={{
                background: active ? 'rgba(244, 63, 94, 0.08)' : 'rgba(0,0,0,0.2)',
                border: `1px solid ${active ? 'rgba(244,63,94,0.35)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: scenario.tone, display: 'inline-flex' }}>{scenario.icon}</span>
                <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{scenario.title}</strong>
                <code style={{ fontSize: '0.7rem', color: '#64748b' }}>{scenario.name}</code>
              </div>

              <div style={{ fontSize: '0.775rem', color: '#94a3b8', lineHeight: 1.5 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Tác động: </span>
                  {scenario.injectedAt}
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Triệu chứng: </span>
                  {scenario.symptom}
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Panel cần xem: </span>
                  <code>{scenario.panel}</code>
                </div>
              </div>

              <button
                onClick={() => void toggle(scenario.name)}
                disabled={busy !== null}
                className={`btn ${active ? 'btn-danger' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', marginTop: 'auto' }}
              >
                {active ? 'Đang bật — bấm để tắt' : 'Inject'}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem' }}>
        Sau khi bật, chạy tải rồi chờ ít nhất hai chu kỳ scrape (30 giây) trước khi đọc panel. Nhớ tắt
        incident trước khi chụp ảnh baseline.
      </p>

      {error && (
        <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '0.75rem' }}>{error}</p>
      )}
    </div>
  );
};
