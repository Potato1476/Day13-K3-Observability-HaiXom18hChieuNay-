import React, { useState } from 'react';
import { Sparkles, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

export const SplineHero: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Exact Spline Scene URL provided by the user
  const splineEmbedUrl = "https://my.spline.design/3dpathslines1copy-r4VDxCYTpWfdEe1vtWRIDASU/";

  return (
    <div
      className="glass-panel"
      style={{
        position: 'relative',
        width: '100%',
        height: isExpanded ? '750px' : '550px',
        borderRadius: '24px',
        overflow: 'hidden',
        marginBottom: '2.5rem',
        transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        background: '#0d0f17'
      }}
    >
      {/* Top Header Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(9,13,22,0.9) 0%, rgba(9,13,22,0) 100%)',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-success" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Spline 3D Scene Interactive Canvas
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }}
          >
            {isExpanded ? (
              <>
                <Minimize2 style={{ width: 14, height: 14 }} /> Collapse View
              </>
            ) : (
              <>
                <Maximize2 style={{ width: 14, height: 14 }} /> Expand 3D View
              </>
            )}
          </button>
          <a
            href={splineEmbedUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }}
          >
            Open Original <ExternalLink style={{ width: 12, height: 12 }} />
          </a>
        </div>
      </div>

      {/* Embedded 3D Spline Scene Canvas - 100% Full Visibility */}
      <iframe
        src={splineEmbedUrl}
        frameBorder="0"
        width="100%"
        height="100%"
        title="Spline 3D Paths Lines Scene"
        allow="autoplay; fullscreen; vr"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          position: 'relative',
          zIndex: 1
        }}
      />
    </div>
  );
};
