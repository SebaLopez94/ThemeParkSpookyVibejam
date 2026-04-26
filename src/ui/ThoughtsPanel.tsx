import { X } from 'lucide-react';
import { FeedMessage } from '../types';

interface ThoughtsPanelProps {
  feed: FeedMessage[];
  onClose: () => void;
  style?: React.CSSProperties;
}

export function ThoughtsPanel({ feed, onClose, style }: ThoughtsPanelProps) {
  return (
    <div className="px-overlay-panel px-panel--thoughts px-shadow-glow" style={style}>
      {/* Header */}
      <div className="px-panel-header" style={{ padding: '24px', borderBottom: '1px solid rgba(148,163,184,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#f8fafc', textShadow: '0 0 12px rgba(148,163,184,0.5)' }}>Visitor Thoughts</h2>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Live feed from the park</p>
        </div>
        <button 
          className="px-btn px-btn--sm" 
          onClick={onClose}
          aria-label="Close thoughts"
          style={{ 
            borderColor: 'rgba(148,163,184,0.4)', 
            color: '#cbd5e1',
            padding: 8
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Feed List */}
      <div className="px-panel-content px-scroll-hidden" style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: 12 }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 16, opacity: 0.5 }}>👻</span>
            No thoughts yet.<br/>Wait for visitors to arrive.
          </div>
        ) : (
          feed.map(msg => (
            <div 
              key={msg.id} 
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px',
                background: 'linear-gradient(145deg, rgba(30,41,59,0.4) 0%, rgba(15,23,42,0.6) 100%)',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: '8px',
                alignItems: 'center'
              }}
            >
              <div style={{ flexShrink: 0, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                {msg.faceImage ? (
                  <img src={msg.faceImage} alt="Visitor face" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 24 }}>{msg.emoji}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#e2e8f0', lineHeight: 1.4 }}>
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
