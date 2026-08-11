import React, { useState } from 'react';
import { Cpu, Activity, FileText, GitCommit, Sliders } from 'lucide-react';
import { MotionControlPanel, type MotionSettings } from './MotionControlPanel';

export type NavTab = 'metrics' | 'logs' | 'traces';

interface HeaderNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  motionSettings: MotionSettings;
  onMotionSettingsChange: (newSettings: MotionSettings) => void;
  apiOnline?: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onTabChange,
  motionSettings,
  onMotionSettingsChange,
  apiOnline = true,
}) => {
  const [showMotionPanel, setShowMotionPanel] = useState(false);

  return (
    <nav className="container" style={{ marginBottom: '2rem', position: 'relative', zIndex: 100 }}>
      <div
        className="glass-panel"
        style={{
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        {/* Studio Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.45rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(6,182,212,0.2) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Cpu style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.01em',
                lineHeight: 1.2
              }}
            >
              Day 13 Observability Studio
            </h1>
          </div>
        </div>

        {/* Center: System API Status & Motion Controller Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', pointerEvents: 'auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: apiOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
              border: `1px solid ${apiOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              color: apiOnline ? '#34d399' : '#f87171'
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: apiOnline ? '#34d399' : '#f87171',
                boxShadow: apiOnline ? '0 0 8px #34d399' : 'none'
              }}
            />
            API {apiOnline ? 'ONLINE :8000' : 'OFFLINE'}
          </div>

          {/* 3D Motion Settings Trigger */}
          <button
            onClick={() => setShowMotionPanel(!showMotionPanel)}
            title="Configure 3D Screen Motion"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: showMotionPanel ? '#06b6d4' : '#94a3b8',
              background: showMotionPanel ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${showMotionPanel ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255, 255, 255, 0.12)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Sliders style={{ width: 13, height: 13 }} /> Motion Control
          </button>
        </div>

        {/* Observability Segmented Navigation */}
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '0.25rem',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'auto'
          }}
        >
          <button
            onClick={() => onTabChange('metrics')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'metrics' ? 600 : 500,
              color: activeTab === 'metrics' ? '#06b6d4' : '#94a3b8',
              background: activeTab === 'metrics' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              border: activeTab === 'metrics' ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Activity style={{ width: 14, height: 14 }} /> Metrics
          </button>

          <button
            onClick={() => onTabChange('logs')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'logs' ? 600 : 500,
              color: activeTab === 'logs' ? '#06b6d4' : '#94a3b8',
              background: activeTab === 'logs' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              border: activeTab === 'logs' ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText style={{ width: 14, height: 14 }} /> Logs
          </button>

          <button
            onClick={() => onTabChange('traces')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'traces' ? 600 : 500,
              color: activeTab === 'traces' ? '#06b6d4' : '#94a3b8',
              background: activeTab === 'traces' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              border: activeTab === 'traces' ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <GitCommit style={{ width: 14, height: 14 }} /> Traces
          </button>
        </div>
      </div>

      {/* Floating Modal Overlay with Topmost Z-Index (Guaranteed On Top Of All Cards) */}
      {showMotionPanel && (
        <>
          {/* Backdrop Overlay to close panel on click */}
          <div
            onClick={() => setShowMotionPanel(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              background: 'transparent',
              pointerEvents: 'auto'
            }}
          />

          {/* Topmost Floating Motion Control Drawer */}
          <div
            style={{
              position: 'fixed',
              top: '5.25rem',
              right: '2rem',
              zIndex: 99999,
              pointerEvents: 'auto'
            }}
          >
            <MotionControlPanel
              settings={motionSettings}
              onChange={onMotionSettingsChange}
              onClose={() => setShowMotionPanel(false)}
            />
          </div>
        </>
      )}
    </nav>
  );
};
