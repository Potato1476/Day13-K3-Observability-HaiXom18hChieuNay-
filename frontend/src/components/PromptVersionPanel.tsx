import React, { useCallback, useEffect, useState } from 'react';
import { GitBranch, RotateCcw, RefreshCw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const API = 'http://127.0.0.1:8000';

interface PromptState {
  ok: boolean;
  tracing_enabled: boolean;
  prompt_name: string;
  prompt_label: string;
  prompt_version: string;
  prompt_source: 'langfuse' | 'local' | 'local-fallback' | string;
  fetch_error: string | null;
  available_labels: string[];
  host: string;
}

/** Ý nghĩa của prompt_source, lấy đúng theo docs/GUIDE.md. */
const SOURCE_INFO: Record<string, { tone: string; title: string; hint: string }> = {
  langfuse: {
    tone: '#34d399',
    title: 'Managed prompt',
    hint: 'Prompt được lấy từ Langfuse. Version hiển thị bên trên là version thật, dùng làm evidence được.',
  },
  local: {
    tone: '#94a3b8',
    title: 'Local template',
    hint: 'Chưa bật tracing. Kiểm tra LANGFUSE_PUBLIC_KEY và LANGFUSE_SECRET_KEY trong .env rồi khởi động lại API.',
  },
  'local-fallback': {
    tone: '#fbbf24',
    title: 'Local fallback',
    hint: 'Đã bật Langfuse nhưng không lấy được prompt. Kiểm tra prompt name/label có tồn tại trên đúng project không.',
  },
};

export const PromptVersionPanel: React.FC = () => {
  const [state, setState] = useState<PromptState | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSwitch, setLastSwitch] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API}/prompt`);
      setState(await res.json());
    } catch {
      setError('Không gọi được API. Kiểm tra uvicorn đang chạy ở cổng 8000.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const switchLabel = async (label: string) => {
    setBusyLabel(label);
    setError(null);
    try {
      const res = await fetch(`${API}/prompt/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      setState(data);
      if (data.previous_label && data.previous_label !== label) {
        setLastSwitch(`${data.previous_label} → ${label}`);
      }
    } catch {
      setError('Đổi label thất bại.');
    } finally {
      setBusyLabel(null);
    }
  };

  const source = state ? SOURCE_INFO[state.prompt_source] ?? SOURCE_INFO.local : null;
  const isManaged = state?.prompt_source === 'langfuse';

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
            <GitBranch style={{ width: 22, height: 22, color: '#a78bfa' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Prompt Version Control</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Đọc prompt đang có hiệu lực và đổi label để demo switch hoặc rollback, không cần restart API
          </p>
        </div>

        <button
          onClick={() => void load()}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>

      {/* Trạng thái prompt hiện tại */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>prompt_name</span>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            {state?.prompt_name ?? '—'}
          </p>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>prompt_label</span>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#a78bfa' }}>
            {state?.prompt_label ?? '—'}
          </p>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>prompt_version</span>
          <p
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: isManaged ? '#34d399' : '#fbbf24',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {state?.prompt_version ?? '—'}
          </p>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>prompt_source</span>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, color: source?.tone ?? '#cbd5e1' }}>
            {state?.prompt_source ?? '—'}
          </p>
        </div>
      </div>

      {/* Nút đổi label */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span
          style={{
            fontSize: '0.85rem',
            color: '#94a3b8',
            fontWeight: 600,
            display: 'block',
            marginBottom: '0.5rem',
          }}
        >
          Đổi label đang dùng (production là label đang chạy thật; rollback = trỏ production về version cũ):
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(state?.available_labels ?? ['baseline', 'candidate', 'production']).map((label) => {
            const active = state?.prompt_label === label;
            return (
              <button
                key={label}
                onClick={() => void switchLabel(label)}
                disabled={busyLabel !== null}
                className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              >
                {busyLabel === label ? (
                  <RotateCcw style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }} />
                ) : active ? (
                  <CheckCircle2 style={{ width: 14, height: 14 }} />
                ) : (
                  <GitBranch style={{ width: 14, height: 14 }} />
                )}
                {label}
              </button>
            );
          })}
        </div>
        {lastSwitch && (
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.6rem' }}>
            Lần đổi gần nhất: <strong style={{ color: '#e2e8f0' }}>{lastSwitch}</strong> — mỗi lần đổi
            đều ghi một log <code>prompt_label_changed</code> dùng làm evidence rollback.
          </p>
        )}
      </div>

      {/* Chẩn đoán nguồn prompt */}
      {source && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            background: isManaged ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)',
            border: `1px solid ${isManaged ? 'rgba(16, 185, 129, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}
        >
          {isManaged ? (
            <CheckCircle2 style={{ width: 18, height: 18, color: '#34d399', flexShrink: 0, marginTop: 2 }} />
          ) : (
            <AlertTriangle style={{ width: 18, height: 18, color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
          )}
          <div>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>{source.title}</p>
            <p style={{ fontSize: '0.825rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{source.hint}</p>
            {state?.fetch_error && (
              <p style={{ fontSize: '0.775rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                fetch_error: <code>{state.fetch_error}</code> &bull; host: <code>{state.host}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '1rem' }}>
          <Info style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} /> {error}
        </p>
      )}
    </div>
  );
};
