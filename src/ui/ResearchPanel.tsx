import { CSSProperties } from 'react';
import { Clock3, FlaskConical, LockKeyhole, X } from 'lucide-react';
import { BUILDING_DISPLAY } from '../types';
import { ResearchNode, ResearchState } from '../types';

interface ResearchPanelProps {
  nodes: ResearchNode[];
  state: ResearchState;
  onStartResearch: (id: string) => void;
  canAffordResearch: (cost: number) => boolean;
  style?: CSSProperties;
  onClose?: () => void;
}

export function ResearchPanel({ nodes, state, onStartResearch, canAffordResearch, style, onClose }: ResearchPanelProps) {
  return (
    <div className="px-scroll-hidden" style={{ width: '100%', maxHeight: '48vh', overflow: 'auto', ...style }}>
      <div className="px-panel px-panel--research" style={{ padding: 0 }}>
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
            <button className="px-btn" style={{ padding: '4px 8px', minHeight: 0 }} onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        )}
        <div style={{ padding: '10px 16px 18px' }}>
          {state.activeResearchId && (() => {
            const activeNode = nodes.find(n => n.id === state.activeResearchId);
            const pct = activeNode ? Math.max(0, Math.min(100, 100 - (state.remainingTime / activeNode.duration) * 100)) : 0;
            const mins = Math.floor(state.remainingTime / 60);
            const secs = Math.ceil(state.remainingTime % 60);
            const timeLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            return (
              <div className="px-stat" style={{ marginBottom: 14, background: 'rgba(103,232,249,0.07)', border: '1px solid rgba(103,232,249,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock3 size={14} color="var(--px-cyan)" />
                    <div className="px-label" style={{ fontSize: 9 }}>RESEARCHING</div>
                  </div>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-cyan)' }}>{timeLabel}</span>
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: 'var(--px-green-hi)', marginBottom: 8 }}>
                  {activeNode?.name}
                </div>
                {/* Timer progress bar */}
                <div style={{ height: 10, background: '#0a0612', border: '2px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'linear-gradient(90deg, var(--px-border), var(--px-cyan))', boxShadow: '0 0 6px rgba(103,232,249,0.5)', transition: 'width 1s linear' }} />
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'grid', gap: 10 }}>
            {nodes.map(node => {
              const completed = state.completed.includes(node.id);
              const active = state.activeResearchId === node.id;
              const unlocked = node.dependencies.every(dep => state.completed.includes(dep));
              const affordable = canAffordResearch(node.cost);
              const disabled = completed || active || !unlocked || !affordable || state.activeResearchId !== null;
              const unlockItems = node.unlocks.map(unlock => ({
                key: unlock,
                icon: BUILDING_DISPLAY[unlock].icon,
                name: BUILDING_DISPLAY[unlock].name
              }));

              return (
                <div
                  key={node.id}
                  className="px-card"
                  style={{
                    cursor: 'default',
                    ...(completed
                      ? {
                          background: 'linear-gradient(180deg, rgba(190,242,100,0.12) 0%, rgba(255,255,255,0.02) 100%), #1f2d16',
                          borderTopColor: 'var(--px-green)',
                          borderLeftColor: 'var(--px-green)',
                          boxShadow: '0 0 0 1px rgba(190,242,100,0.18), 3px 3px 0 #000'
                        }
                      : active
                        ? {
                            background: 'linear-gradient(180deg, rgba(103,232,249,0.14) 0%, rgba(255,255,255,0.02) 100%), #14273a',
                            borderTopColor: 'var(--px-cyan)',
                            borderLeftColor: 'var(--px-cyan)',
                            boxShadow: '0 0 0 1px rgba(103,232,249,0.22), 3px 3px 0 #000'
                          }
                        : {})
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: 'var(--px-text)', lineHeight: 1.8 }}>
                      {node.name}
                    </div>
                    {completed ? (
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)', lineHeight: 1.8 }}>
                        COMPLETE
                      </span>
                    ) : active ? (
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-cyan)', lineHeight: 1.8 }}>
                        IN PROGRESS
                      </span>
                    ) : !unlocked ? (
                      <LockKeyhole size={14} color="var(--px-muted)" />
                    ) : null}
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-muted)', lineHeight: 1.9, marginTop: 8 }}>
                    {node.description}
                  </div>
                  <div className="px-chip-row" style={{ marginTop: 10 }}>
                    {unlockItems.map(item => (
                      <div key={item.key} className="px-chip" style={{ fontSize: 11, padding: '10px 12px', gap: 10 }}>
                        <span className="px-chip__emoji" aria-hidden="true" style={{ fontSize: 24 }}>
                          {item.icon}
                        </span>
                        <span style={{ lineHeight: 1.7 }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-chip-row" style={{ marginTop: 10 }}>
                    <div className="px-chip">
                      <FlaskConical size={16} />
                      ${node.cost}
                    </div>
                    <div className="px-chip">
                      <Clock3 size={16} />
                      {node.duration}s
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className={`px-btn ${completed ? 'px-btn--active' : ''}`}
                      style={{ fontSize: 10, padding: '10px 14px', opacity: disabled ? 0.5 : 1 }}
                      disabled={disabled}
                      onClick={() => onStartResearch(node.id)}
                    >
                      {completed ? 'DONE' : active ? 'ACTIVE' : 'START'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
