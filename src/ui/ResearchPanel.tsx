import { CSSProperties } from 'react';
import { Clock3, FlaskConical, LockKeyhole, Play, Sparkles, X } from 'lucide-react';
import { BUILDING_DISPLAY, BuildingType, DecorationType, PlaceableBuildingKind, ResearchNode, ResearchState, RideType, ServiceType, ShopType } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { BuildAssetPreview } from './BuildAssetPreview';

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

function getBuildingTypeFromUnlock(kind: PlaceableBuildingKind): BuildingType {
  if ((Object.values(RideType) as string[]).includes(kind)) return BuildingType.RIDE;
  if ((Object.values(ShopType) as string[]).includes(kind)) return BuildingType.SHOP;
  if ((Object.values(ServiceType) as string[]).includes(kind)) return BuildingType.SERVICE;
  if ((Object.values(DecorationType) as string[]).includes(kind)) return BuildingType.DECORATION;
  return BuildingType.DECORATION;
}

function getUnlockPreviewItem(kind: PlaceableBuildingKind) {
  const display = BUILDING_DISPLAY[kind];
  return {
    type: getBuildingTypeFromUnlock(kind),
    subType: kind,
    name: display.name,
  };
}

function isResearchNodeReady(node: ResearchNode, completed: string[]): boolean {
  const requiredDone = node.dependencies.every(dep => completed.includes(dep));
  const anyRequiredDone = !node.dependenciesAny?.length || node.dependenciesAny.some(dep => completed.includes(dep));
  return requiredDone && anyRequiredDone;
}

function getMissingResearchLabels(node: ResearchNode, nodes: ResearchNode[], completed: string[]): string {
  const missingRequired = node.dependencies
    .filter(dep => !completed.includes(dep))
    .map(dep => nodes.find(item => item.id === dep)?.name)
    .filter((value): value is string => Boolean(value));

  if (node.dependenciesAny?.length && !node.dependenciesAny.some(dep => completed.includes(dep))) {
    const alternatives = node.dependenciesAny
      .map(dep => nodes.find(item => item.id === dep)?.name)
      .filter((value): value is string => Boolean(value));
    if (alternatives.length > 0) missingRequired.push(alternatives.join(' or '));
  }

  return missingRequired.join(' + ');
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
    isResearchNodeReady(node, state.completed)
  );

  const lockedNodes = nodes.filter(node =>
    !state.completed.includes(node.id) &&
    !isResearchNodeReady(node, state.completed)
  );

  const completedCount = state.completed.length;
  const totalCount = nodes.length;

  return (
    <div className="px-panel px-panel--research px-overlay-panel" style={{ width: '100%', maxHeight: isMobile ? '56vh' : 'calc(100vh - 32px)', padding: 0, ...style }}>
      <div className="px-overlay-panel__top">
        <div className="px-overlay-panel__meta">
          <span className="px-label" style={{ color: 'var(--px-cyan)' }}>Lab</span>
          <span className="px-overlay-panel__count">{completedCount}/{totalCount}</span>
        </div>
        {onClose && (
          <button className="px-btn px-btn--sm" aria-label="Close lab panel" onClick={onClose} style={{ color: '#67e8f9', borderColor: 'rgba(103,232,249,0.3)', ...(isMobile ? { padding: '4px 8px', minHeight: 32 } : {}) }}>
            <X />
          </button>
        )}
      </div>

      <div className="px-overlay-panel__body px-scroll-hidden" style={{ padding: isMobile ? '10px 12px 14px' : '14px 16px 18px', display: 'grid', alignContent: 'start', gap: isMobile ? 10 : 12 }}>
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
                  {activeNode ? activeNode.name : 'NO ACTIVE PROJECT'}
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
                No active project. Start one to unlock the next building.
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
                    <div className="px-research-project">
                      <BuildAssetPreview item={getUnlockPreviewItem(unlockItem)} variant="research" />

                      <div className="px-research-project__content">
                        <div className="px-research-project__name">
                          {unlockDisplay.name}
                        </div>

                        <div className="px-chip-row px-research-project__meta">
                          <div className="px-soft-chip">
                            <FlaskConical className="px-icon-sm" />
                            ${node.cost}
                          </div>
                          <div className="px-soft-chip">
                            <Clock3 className="px-icon-sm" />
                            {node.duration}s
                          </div>
                          {!affordable && (
                            <div className="px-soft-chip" style={{ color: 'var(--px-red)' }}>
                              NOT ENOUGH CASH
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-research-project__action">
                        <button
                          className="px-btn px-btn--sm"
                          style={{
                            opacity: disabled ? 0.55 : 1,
                            color: active ? 'var(--px-cyan)' : undefined,
                          }}
                          disabled={disabled}
                          onClick={() => onStartResearch(node.id)}
                        >
                          {active ? (
                            <Clock3 className="px-icon-sm" />
                          ) : blockedByActiveResearch ? (
                            <LockKeyhole className="px-icon-sm" />
                          ) : (
                            <Play className="px-icon-sm" />
                          )}
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
                const missing = getMissingResearchLabels(node, nodes, state.completed);

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
                    <div className="px-research-project px-research-project--locked">
                      <BuildAssetPreview item={getUnlockPreviewItem(unlockItem)} variant="research" locked />
                      <div className="px-research-project__content">
                        <div className="px-research-project__name">
                          {unlockDisplay.name}
                        </div>
                        <div className="px-body px-research-project__requires">
                          Requires: {missing}
                        </div>
                      </div>
                      <LockKeyhole className="px-research-project__lock" color="var(--px-muted)" />
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
