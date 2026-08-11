import React, { useState } from 'react';
import { Zap, Play, Flame, ShieldAlert, RotateCcw } from 'lucide-react';

export const StressTestPanel: React.FC<{ onTestComplete?: () => void }> = ({ onTestComplete }) => {
  const [concurrency, setConcurrency] = useState(10);
  const [requests, setRequests] = useState(30);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    success: number;
    failed: number;
    avg_latency_ms: number;
  } | null>(null);
  const [activeIncident, setActiveIncident] = useState<string | null>(null);

  const handleRunTest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrency, requests }),
      });
      const data = await res.json();
      setResult(data);
      if (onTestComplete) onTestComplete();
    } catch (e) {
      console.error('Stress test failed', e);
    } finally {
      setRunning(false);
    }
  };

  const toggleIncident = async (name: string) => {
    try {
      if (activeIncident === name) {
        await fetch(`http://127.0.0.1:8000/incidents/${name}/disable`, { method: 'POST' });
        setActiveIncident(null);
      } else {
        if (activeIncident) {
          await fetch(`http://127.0.0.1:8000/incidents/${activeIncident}/disable`, { method: 'POST' });
        }
        await fetch(`http://127.0.0.1:8000/incidents/${name}/enable`, { method: 'POST' });
        setActiveIncident(name);
      }
      if (onTestComplete) onTestComplete();
    } catch (e) {
      console.error('Incident toggle failed', e);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap style={{ width: 22, height: 22, color: '#f59e0b' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Interactive Stress Test Engine</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Dispatch concurrent requests to load test FastAPI, Prometheus rate calculations, and Grafana alert thresholds
          </p>
        </div>

        <button
          onClick={handleRunTest}
          className="btn btn-primary"
          style={{ padding: '0.8rem 1.75rem', fontSize: '1rem' }}
          disabled={running}
        >
          {running ? (
            <>
              <RotateCcw style={{ animation: 'spin 1s linear infinite', width: 18, height: 18 }} /> Running Load Test...
            </>
          ) : (
            <>
              <Play style={{ width: 18, height: 18, fill: 'currentColor' }} /> Run Stress Test
            </>
          )}
        </button>
      </div>

      {/* Control Sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <span>Worker Concurrency:</span>
            <span style={{ color: '#818cf8' }}>{concurrency} threads</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
          />
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <span>Total Requests:</span>
            <span style={{ color: '#06b6d4' }}>{requests} calls</span>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={requests}
            onChange={(e) => setRequests(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Incident Injectors */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
          Inject Incident Scenarios (Practice Failure Simulations):
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => toggleIncident('rag_slow')}
            className={`btn ${activeIncident === 'rag_slow' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <Flame style={{ width: 14, height: 14 }} /> RAG Slow (+3s Latency)
          </button>
          <button
            onClick={() => toggleIncident('tool_fail')}
            className={`btn ${activeIncident === 'tool_fail' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <ShieldAlert style={{ width: 14, height: 14 }} /> Tool Fail (500 Error Spike)
          </button>
          <button
            onClick={() => toggleIncident('cost_spike')}
            className={`btn ${activeIncident === 'cost_spike' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <Zap style={{ width: 14, height: 14 }} /> Cost Spike
          </button>
        </div>
      </div>

      {/* Live Stress Test Results Banner */}
      {result && (
        <div style={{
          background: result.failed > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${result.failed > 0 ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          padding: '1.25rem',
          borderRadius: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Executed</span>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>{result.total}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Success (200)</span>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>{result.success}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Failed (500)</span>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: result.failed > 0 ? '#f87171' : '#cbd5e1' }}>{result.failed}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Average Latency</span>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>{result.avg_latency_ms} ms</p>
          </div>
        </div>
      )}
    </div>
  );
};
