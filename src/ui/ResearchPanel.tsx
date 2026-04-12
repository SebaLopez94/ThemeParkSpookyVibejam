import { CSSProperties } from 'react';
import { Clock3, FlaskConical, LockKeyhole, Sparkles, X } from 'lucide-react';
import { BUILDING_DISPLAY, ResearchNode, ResearchState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ResearchPanelProps {
  nodes: ResearchNode[];
  state: ResearchState;
  onStartResearch: (id: string) => void;
  canAffordResearch: (cost: number) => boolean;
  style?: CSSProperties;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function ResearchPanel({
  nodes,
  state,
  onStartResearch,
  canAffordResearch,
  style,
  onClose
}: ResearchPanelProps) {
  const isMobile = useIsMobile();
  const activeNode = state.activeResearchId
    ? nodes.find(node => node.id === state.activeResearchId) ?? null
    : null;

  const activeProgress = activeNode
    ? Math.max(0, Math.min(100, 100 - (state.remainingTime / activeNode.duration) * 100))
    : 0;

  const readyNodes = nodes.filter(node =>
    !state.completed.includes(node.id) &&
    node.dependencies.every(dep => state.completed.includes(dep))
  );

  const lockedNodes = nodes.filter(node =>
    !state.completed.includes(node.id) &&
    node.dependencies.some(dep => !state.completed.includes(dep))
  );

  const completedCount = state.completed.length;
  const totalCount = nodes.length;

  return (
    <div className="px-panel px-panel--research px-overlay-panel" style={{ width: '100%', maxHeight: isMobile ? '56vh' : '48vh', padding: 0, ...style }}>
      <div className="px-overlay-panel__top">
        <div className="px-overlay-panel__meta">
          <span className="px-label" style={{ color: 'var(--px-cyan)' }}>Research</span>
          <span className="px-overlay-panel__count">{completedCount}/{totalCount}</span>
        </div>
        {onClose && (
          <button className="px-btn px-btn--sm" aria-label="Close research panel" onClick={onClose} style={isMobile ? { padding: '4px 8px', minHeight: 32 } : undefined}>
            <X />
          </button>
        )}
      </div>

      <div className="px-overlay-panel__body px-scroll-hidden" style={{ padding: isMobile ? '10px 12px 14px' : '14px 16px 18px', display: 'grid', gap: isMobile ? 10 : 12 }}>
          <div
            className="px-stat px-soft-block"
            style={{
              background: 'linear-gradient(180deg, rgba(12,24,43,0.96) 0%, rgba(8,14,27,0.96) 100%)',
              padding: isMobile ? '10px 10px 12px' : '12px 14px 14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div className="px-label" style={{ fontSize: isMobile ? 8 : 9, color: 'var(--px-cyan)' }}>
                  {activeNode ? 'ACTIVE PROJECT' : 'LAB STATUS'}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: isMobile ? 10 : 12,
                    color: activeNode ? 'var(--px-green-hi)' : 'var(--px-text)',
                    lineHeight: 1.7
                  }}
                >
                  {activeNode ? activeNode.name : 'NO ACTIVE RESEARCH'}
                </div>
              </div>

              <div className="px-soft-chip" style={{ color: 'var(--px-cyan)' }}>
                <Sparkles className="px-icon-sm" />
                {readyNodes.length} READY
              </div>
            </div>

            {activeNode ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
                  <div className="px-soft-chip">
                    <Clock3 className="px-icon-sm" />
                    {formatTime(state.remainingTime)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: isMobile ? 8 : 9,
                      color: 'var(--px-cyan)'
                    }}
                  >
                    {Math.round(activeProgress)}%
                  </div>
                </div>
                <div className="px-soft-progress" style={{ marginTop: 10 }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${activeProgress}%`,
                      background: 'linear-gradient(90deg, #2563eb 0%, #67e8f9 100%)',
                      boxShadow: '0 0 10px rgba(103,232,249,0.4)',
                      transition: 'width 1s linear'
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="px-body" style={{ marginTop: 10 }}>
                No active research. Start one project to unlock the next building.
              </div>
            )}
          </div>

          {readyNodes.length > 0 && (
            <div className="px-soft-section">
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                AVAILABLE PROJECTS
              </div>
              {readyNodes.map(node => {
                const completed = state.completed.includes(node.id);
                const active = state.activeResearchId === node.id;
                const affordable = canAffordResearch(node.cost);
                const blockedByActiveResearch = state.activeResearchId !== null;
                const disabled = completed || active || !affordable || blockedByActiveResearch;
                const unlockItem = node.unlocks[0];
                const unlockDisplay = BUILDING_DISPLAY[unlockItem];

                return (
                  <div
                    key={node.id}
                    className={`px-soft-card ${active ? 'px-soft-card--active' : ''}`}
                    style={{
                      padding: isMobile ? '10px' : '12px',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: isMobile ? 10 : 12, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
                          <div
                            className="px-soft-block"
                            style={{
                              width: isMobile ? 36 : 48,
                              height: isMobile ? 36 : 48,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              background: 'rgba(103,232,249,0.06)',
                            }}
                          >
                            <span className="px-emoji" style={{ fontSize: isMobile ? 18 : 24 }}>
                              {unlockDisplay.icon}
                            </span>
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: isMobile ? 8 : 11,
                                color: 'var(--px-text)',
                                lineHeight: isMobile ? 1.55 : 1.7
                              }}
                            >
                              {unlockDisplay.name}
                            </div>
                          </div>
                        </div>

                        <div className="px-chip-row" style={{ marginTop: isMobile ? 8 : 10, gap: isMobile ? 6 : 8 }}>
                          <div className="px-soft-chip">
                            <FlaskConical className="px-icon-sm" />
                            ${node.cost}
                          </div>
                          <div className="px-soft-chip">
                            <Clock3 className="px-icon-sm" />
                            {node.duration}s
                          </div>
                          <div className="px-soft-chip">
                            UNLOCKS {unlockDisplay.icon}
                          </div>
                          {!affordable && (
                            <div className="px-soft-chip" style={{ color: 'var(--px-red)' }}>
                              NOT ENOUGH CASH
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
                        <button
                          className="px-btn px-btn--sm"
                          style={{
                            minWidth: isMobile ? '100%' : 132,
                            opacity: disabled ? 0.55 : 1,
                            color: active ? 'var(--px-cyan)' : undefined,
                            ...(isMobile ? { padding: '8px 10px', minHeight: 38 } : {})
                          }}
                          disabled={disabled}
                          onClick={() => onStartResearch(node.id)}
                        >
                          {active ? 'ACTIVE' : blockedByActiveResearch ? 'BUSY' : 'START'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {lockedNodes.length > 0 && (
            <div className="px-soft-section">
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                LOCKED PROJECTS
              </div>
              {lockedNodes.map(node => {
                const unlockItem = node.unlocks[0];
                const unlockDisplay = BUILDING_DISPLAY[unlockItem];
                const missing = node.dependencies
                  .map(dep => nodes.find(item => item.id === dep)?.name)
                  .filter((value): value is string => Boolean(value));

                return (
                  <div
                    key={node.id}
                    className="px-soft-card"
                    style={{
                      cursor: 'default',
                      padding: isMobile ? '10px' : '12px',
                      opacity: 0.78,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 8 : 10 }}>
                      <div
                        className="px-soft-block"
                        style={{
                          width: isMobile ? 32 : 42,
                          height: isMobile ? 32 : 42,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <LockKeyhole className="px-icon-sm" color="var(--px-muted)" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: isMobile ? 8 : 10,
                            color: 'var(--px-text)',
                            lineHeight: isMobile ? 1.55 : 1.7
                          }}
                        >
                          {unlockDisplay.name}
                        </div>
                        <div className="px-body" style={{ marginTop: 3, fontSize: isMobile ? 11 : undefined, lineHeight: isMobile ? 1.45 : undefined }}>
                          Requires: {missing.join(' + ')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
