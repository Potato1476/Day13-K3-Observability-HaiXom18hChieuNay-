import React from 'react';
import { Sliders, RotateCcw, Compass, Wind } from 'lucide-react';

export interface MotionSettings {
  parallaxEnabled: boolean;
  idleEnabled: boolean;
  intensity: number; // 0.2 to 2.5
  maxTilt: number; // 0 to 5 degrees
  easingSpeed: number; // 0.01 to 0.1
}

export const defaultMotionSettings: MotionSettings = {
  parallaxEnabled: true,
  idleEnabled: true,
  intensity: 1.0,
  maxTilt: 1.6,
  easingSpeed: 0.035,
};

interface MotionControlPanelProps {
  settings: MotionSettings;
  onChange: (newSettings: MotionSettings) => void;
  onClose?: () => void;
}

export const MotionControlPanel: React.FC<MotionControlPanelProps> = ({
  settings,
  onChange,
  onClose,
}) => {
  const update = (key: keyof MotionSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  const resetDefaults = () => {
    onChange(defaultMotionSettings);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '16px',
        width: '320px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        color: '#f8fafc',
        pointerEvents: 'auto'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.6rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Sliders style={{ width: 16, height: 16, color: '#06b6d4' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>3D Motion Controller</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={resetDefaults}
            title="Reset to default motion"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.2rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#06b6d4')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close panel"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {/* Parallax Mouse Follow Switch */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <Compass style={{ width: 14, height: 14, color: '#818cf8' }} /> Cursor Parallax
          </div>
          <button
            onClick={() => update('parallaxEnabled', !settings.parallaxEnabled)}
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: settings.parallaxEnabled ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${settings.parallaxEnabled ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: settings.parallaxEnabled ? '#34d399' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {settings.parallaxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Ambient Breathing Switch */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <Wind style={{ width: 14, height: 14, color: '#06b6d4' }} /> Idle Breathing
          </div>
          <button
            onClick={() => update('idleEnabled', !settings.idleEnabled)}
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: settings.idleEnabled ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${settings.idleEnabled ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: settings.idleEnabled ? '#06b6d4' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {settings.idleEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Motion Amplitude Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <span>Motion Amplitude</span>
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{settings.intensity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={settings.intensity}
            onChange={(e) => update('intensity', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer' }}
          />
        </div>

        {/* Max Tilt Angle Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <span>Max 3D Tilt</span>
            <span style={{ color: '#818cf8', fontWeight: 600 }}>{settings.maxTilt.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.2"
            value={settings.maxTilt}
            onChange={(e) => update('maxTilt', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
          />
        </div>

        {/* Lerp Easing Speed Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <span>Easing Smoothness</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>
              {settings.easingSpeed <= 0.03 ? 'Cinematic' : settings.easingSpeed <= 0.06 ? 'Smooth' : 'Fast'}
            </span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.1"
            step="0.005"
            value={settings.easingSpeed}
            onChange={(e) => update('easingSpeed', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#34d399', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
};
