import React, { useEffect, useState } from 'react';
import { Activity, Clock, AlertTriangle, DollarSign, Cpu, Award, RefreshCw } from 'lucide-react';

interface MetricSummary {
  requests: number;
  errors: number;
  avgLatencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  qualityScore: number;
}

export const MetricsOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchMetrics = async () => {
    if (loading) return; // Prevent duplicate concurrent refresh calls
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/metrics');
      const text = await res.text();
      
      let reqCount = 0;
      let errCount = 0;
      let latCount = 0;
      let latSum = 0;
      let tIn = 0;
      let tOut = 0;
      let cost = 0;
      let qCount = 0;
      let qSum = 0;

      text.split('\n').forEach(line => {
        if (line.startsWith('#') || !line.trim()) return;
        if (line.includes('ai_requests_total')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) {
            const val = parseFloat(match[1]);
            if (line.includes('status="error"')) errCount += val;
            else reqCount += val;
          }
        }
        if (line.includes('ai_request_latency_seconds_count')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) latCount += parseFloat(match[1]);
        }
        if (line.includes('ai_request_latency_seconds_sum')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) latSum += parseFloat(match[1]);
        }
        if (line.includes('ai_tokens_total')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) {
            const val = parseFloat(match[1]);
            if (line.includes('direction="input"')) tIn += val;
            if (line.includes('direction="output"')) tOut += val;
          }
        }
        if (line.includes('ai_cost_usd_total')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) cost += parseFloat(match[1]);
        }
        if (line.includes('ai_quality_score_count')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) qCount += parseFloat(match[1]);
        }
        if (line.includes('ai_quality_score_sum')) {
          const match = line.match(/(\d+(\.\d+)?)$/);
          if (match) qSum += parseFloat(match[1]);
        }
      });

      const avgLat = latCount > 0 ? (latSum / latCount) * 1000 : 0;
      const avgQual = qCount > 0 ? qSum / qCount : 0;

      setMetrics({
        requests: reqCount + errCount,
        errors: errCount,
        avgLatencyMs: avgLat,
        tokensIn: tIn,
        tokensOut: tOut,
        costUsd: cost,
        qualityScore: avgQual,
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Failed to fetch metrics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      title: 'Total Traffic',
      value: metrics ? `${metrics.requests} reqs` : '...',
      sub: `${metrics?.errors || 0} errors`,
      icon: Activity,
      color: '#06b6d4',
    },
    {
      title: 'Avg Latency',
      value: metrics ? `${metrics.avgLatencyMs.toFixed(1)} ms` : '...',
      sub: 'Histogram average',
      icon: Clock,
      color: '#818cf8',
    },
    {
      title: 'Error Rate',
      value: metrics && metrics.requests > 0 ? `${((metrics.errors / metrics.requests) * 100).toFixed(1)}%` : '0%',
      sub: 'Target <= 2%',
      icon: AlertTriangle,
      color: metrics && (metrics.errors / (metrics.requests || 1)) > 0.02 ? '#f43f5e' : '#10b981',
    },
    {
      title: 'Total Cost',
      value: metrics ? `$${metrics.costUsd.toFixed(4)}` : '...',
      sub: 'Cumulative USD',
      icon: DollarSign,
      color: '#f59e0b',
    },
    {
      title: 'Token Usage',
      value: metrics ? `${(metrics.tokensIn + metrics.tokensOut).toLocaleString()}` : '...',
      sub: `${metrics?.tokensIn.toLocaleString()} in / ${metrics?.tokensOut.toLocaleString()} out`,
      icon: Cpu,
      color: '#a855f7',
    },
    {
      title: 'Quality Score',
      value: metrics ? metrics.qualityScore.toFixed(2) : '...',
      sub: 'Mean (0 to 1)',
      icon: Award,
      color: '#10b981',
    },
  ];

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Section Header with integrated compact Refresh button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>Real-Time Metric Telemetry</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Live observations scraped directly from /metrics endpoint</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
              Last updated {lastUpdated}
            </span>
          )}

          <button
            onClick={fetchMetrics}
            disabled={loading}
            title="Refresh metrics"
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
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(12px)',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.color = '#06b6d4';
                e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <RefreshCw
              style={{
                width: 14,
                height: 14,
                animation: loading ? 'spin 0.8s linear infinite' : 'none'
              }}
            />
          </button>
        </div>
      </div>

      {/* Grid container preserving card dimensions to prevent layout jumps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', minHeight: '130px' }}>
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>{c.title}</span>
                <div style={{ padding: '0.35rem', borderRadius: '6px', background: `${c.color}15`, color: c.color }}>
                  <Icon style={{ width: 16, height: 16 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', marginBottom: '0.15rem' }}>
                  {c.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {c.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
