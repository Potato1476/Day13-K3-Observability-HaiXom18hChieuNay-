import React, { useState } from 'react';
import { SplineBackground } from './components/SplineBackground';
import { HeaderNav, type NavTab } from './components/HeaderNav';
import { MetricsOverview } from './components/MetricsOverview';
import { IncidentPanel } from './components/IncidentPanel';
import { StressTestPanel } from './components/StressTestPanel';
import { GrafanaViewer } from './components/GrafanaViewer';
import { LogsView } from './components/LogsView';
import { PromptVersionPanel } from './components/PromptVersionPanel';
import { TracesView } from './components/TracesView';
import { defaultMotionSettings, type MotionSettings } from './components/MotionControlPanel';
import { Sparkles, Activity, ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('metrics');
  const [motionSettings, setMotionSettings] = useState<MotionSettings>(defaultMotionSettings);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 3D Spline Interactive Background Canvas (Controlled via Motion Settings) */}
      <SplineBackground settings={motionSettings} />

      {/* Foreground Content Container - Mouse events pass through empty spaces */}
      <div style={{ position: 'relative', zIndex: 10, padding: '1.5rem 0 4rem 0', pointerEvents: 'none' }}>
        
        {/* Top Navbar with API Status, Motion Controller & Navigation [ Metrics ] [ Logs ] [ Traces ] */}
        <HeaderNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          motionSettings={motionSettings}
          onMotionSettingsChange={setMotionSettings}
        />

        {/* Main Content Area */}
        <main className="container">
          {activeTab === 'metrics' && (
            <>
              {/* Hero Content Panel floating over 3D Canvas */}
              <div className="glass-panel" style={{ padding: '2.5rem 2.25rem', marginBottom: '2.5rem', maxWidth: '780px' }}>
                <div className="badge badge-success" style={{ alignSelf: 'flex-start', marginBottom: '1rem' }}>
                  <Sparkles style={{ width: 14, height: 14 }} /> 3D Spline Interactive Environment
                </div>

                <h1 style={{
                  fontSize: 'clamp(2.2rem, 4.2vw, 3.25rem)',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  marginBottom: '1rem',
                  background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #818cf8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Real-Time AI Observability & Performance Control
                </h1>

                <p style={{ fontSize: '1.05rem', color: '#94a3b8', marginBottom: '1.75rem', lineHeight: 1.6 }}>
                  Observe live Prometheus metrics, track PromQL aggregations, inspect Grafana dashboards, and execute multi-threaded stress tests.
                </p>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                    <Activity style={{ width: 16, height: 16, color: '#06b6d4' }} /> Scrape Interval: 15s
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}>
                    <ShieldCheck style={{ width: 16, height: 16, color: '#10b981' }} /> Contract Panels: 6/6 Active
                  </div>
                </div>
              </div>

              {/* Real-time Telemetry Metrics */}
              <MetricsOverview />

              {/* Bật tắt ba kịch bản sự cố practice, trạng thái đọc từ API */}
              <IncidentPanel />

              {/* Stress Test Engine with Button */}
              <StressTestPanel />

              {/* Live Grafana & Prometheus Embeds */}
              <GrafanaViewer />
            </>
          )}

          {activeTab === 'logs' && <LogsView />}

          {activeTab === 'traces' && (
            <>
              {/* prompt_name / label / version / source + nút đổi label và rollback */}
              <PromptVersionPanel />
              <TracesView />
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="container" style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <p>Day 13 AI Observability Studio &bull; Schema Version 2 &bull; 6 Contract Panels Active</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
