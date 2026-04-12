import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0e0a1e',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 24, padding: 32, fontFamily: "'Press Start 2P', monospace"
      }}>
        <div style={{ fontSize: 'clamp(10px, 3vw, 18px)', color: '#fb7185', textShadow: '2px 2px 0 #000', textAlign: 'center', lineHeight: 2 }}>
          ⚠ SOMETHING WENT WRONG
        </div>
        <div style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: '#c4b5fd', textAlign: 'center', lineHeight: 2, maxWidth: 480 }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(180deg, #31214a 0%, #221432 100%)',
            border: '3px solid #ddd6fe', borderRightColor: '#14091f', borderBottomColor: '#14091f',
            boxShadow: '3px 3px 0 #000', padding: '14px 28px',
            fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(8px, 2vw, 12px)',
            color: '#d9f99d', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 2
          }}
        >
          ↺ Reload Game
        </button>
      </div>
    );
  }
}
