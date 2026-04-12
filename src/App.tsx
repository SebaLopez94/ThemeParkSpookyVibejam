import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useIsMobile } from './hooks/useIsMobile';
import { FlaskConical, Hammer, Landmark, MousePointer2, RotateCw, ScrollText, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { Game } from './Game';
import { INITIAL_UNLOCKED_BUILDINGS, getPathDefinition } from './data/buildings';
import { ChallengesPanel } from './ui/ChallengesPanel';
import { BuildMenu } from './ui/BuildMenu';
import { BuildingPanel } from './ui/BuildingPanel';
import { HUD } from './ui/HUD';
import { ParkPanel } from './ui/ParkPanel';
import { ResearchPanel } from './ui/ResearchPanel';
import { ToastItem, ToastStack } from './ui/ToastStack';
import {
  BuildingType,
  ChallengeState,
  EconomyState,
  BuildingDefinition,
  GridPosition,
  ResearchNode,
  ResearchState,
  SelectedBuildingInfo
} from './types';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [economy, setEconomy] = useState<EconomyState>({
    money: 3500,
    ticketPrice: 8,
    totalVisitors: 0,
    activeVisitors: 0,
    parkRating: 10,
    averageHappiness: 10,
    dailyIncome: 0,
    dailyExpenses: 0,
    netProfit: 0,
    isOpen: true
  });
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuildingInfo | null>(null);
  const [buildRotation, setBuildRotation] = useState(0);
  const [isPlacing, setIsPlacing] = useState(false);
  // Pre-populate with initial unlocked buildings so they show in the build
  // menu immediately — the ResearchSystem fires its first notify() before
  // game.onResearchUpdate is assigned, so React state would otherwise start empty.
  const [researchState, setResearchState] = useState<ResearchState>(() => ({
    unlocked: [...INITIAL_UNLOCKED_BUILDINGS],
    completed: [],
    activeResearchId: null,
    remainingTime: 0
  }));
  const [researchNodes, setResearchNodes] = useState<ResearchNode[]>([]);
  const [challenges, setChallenges] = useState<ChallengeState[]>([]);
  const [localTicketPrice, setLocalTicketPrice] = useState(8);
  const [showResearch, setShowResearch] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showParkPanel, setShowParkPanel] = useState(false);
  const [activeBuildDefinition, setActiveBuildDefinition] = useState<BuildingDefinition | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [celebration, setCelebration] = useState<{ title: string; sub: string; reward: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const pushToast = (tone: ToastItem['tone'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(current => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 2600);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const game = new Game(containerRef.current);
    gameRef.current = game;

    game.onEconomyUpdate = state => {
      setEconomy(state);
    };
    game.onBuildingSelected = info => {
      setSelectedBuilding(info);
      if (info !== null) setShowBuildMenu(false);
    };
    game.onBuildCancel = () => {
      setSelectedBuilding(null);
      setShowBuildMenu(false);
      setIsPlacing(false);
      setActiveBuildDefinition(null);
    };
    game.onRotationChange = degree => setBuildRotation(degree);
    game.onResearchUpdate = state => setResearchState(state);
    game.onChallengesUpdate = state => setChallenges(state);
    game.onChallengeCompleted = challenge => {
      const celebrationIds: Record<string, { title: string; sub: string }> = {
        challenge_first_ride:   { title: '🎡 FIRST RIDE OPEN!',      sub: 'The crowds are flooding in!' },
        challenge_three_rides:  { title: '🎢 THRILL PARK UNLOCKED!',  sub: 'Three rides — fear is your product.' },
        challenge_rating:       { title: '⭐ FIVE-STAR NIGHTMARE!',   sub: 'The park is legendary.' },
        challenge_visitors_150: { title: '💀 THOUSAND SCREAMS!',     sub: 'Your park is a phenomenon.' },
      };
      const cel = celebrationIds[challenge.id] || { title: `🎯 ${challenge.title.toUpperCase()}`, sub: challenge.description };
      setCelebration({ ...cel, reward: challenge.reward.money });
      
      confetti({
        particleCount: isMobile ? 60 : 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#d9f99d', '#67e8f9', '#a78bfa']
      });

      window.setTimeout(() => setCelebration(null), 3400);
    };

    setResearchNodes(game.getResearchNodes());

    game.start();
    return () => {
      game.dispose();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (showHelp) {
        setShowHelp(false);
        return;
      }

      if (selectedBuilding) {
        setSelectedBuilding(null);
        return;
      }

      if (showBuildMenu || isPlacing) {
        handleCancelBuildMode();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showHelp, selectedBuilding, showBuildMenu, isPlacing]);

  const isMobile = useIsMobile();

  const handleSelectBuilding = (definition: BuildingDefinition) => {
    gameRef.current?.selectBuilding(definition);
    setShowBuildMenu(false);
    setSelectedBuilding(null);
    setIsPlacing(true);
    setBuildRotation(0);
    setActiveBuildDefinition(definition);
    if (!isMobile) {
      pushToast('info', `Placing ${definition.name}. Left click to build, Esc or right click to cancel.`);
    }
  };

  const handleCancelBuildMode = () => {
    gameRef.current?.cancelBuildMode();
    setShowBuildMenu(false);
    setIsPlacing(false);
    setActiveBuildDefinition(null);
  };

  const handleClosePanel = () => {
    setSelectedBuilding(null);
    gameRef.current?.cancelBuildMode();
    gameRef.current?.deselectBuilding();
  };

  const handleDeleteBuilding = (position: GridPosition) => {
    gameRef.current?.deleteBuilding(position);
    setSelectedBuilding(null);
  };

  const handleMoveBuilding = (info: SelectedBuildingInfo) => {
    gameRef.current?.startMoveBuilding(info);
    setSelectedBuilding(null);
    setIsPlacing(true);
    setActiveBuildDefinition({
      type: info.buildingType,
      subType: info.subType,
      name: info.name,
      description: '',
      cost: 0,
      icon: info.icon
    });
    if (!isMobile) pushToast('info', `Moving ${info.name}. Choose a new valid tile.`);
  };

  const handlePriceChange = (position: GridPosition, newPrice: number) => {
    gameRef.current?.updateBuildingPrice(position, newPrice);
  };

  const handleTicketCommit = () => {
    const clamped = Math.max(0, Math.min(50, Math.round(localTicketPrice)));
    setLocalTicketPrice(clamped);
    gameRef.current?.setTicketPrice(clamped);
    pushToast('success', `Park entry price updated to $${clamped}.`);
  };

  const handleToggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    gameRef.current?.setMuted(newState);
    pushToast('info', newState ? 'Audio muted' : 'Audio unmuted');
  };

  const canAfford = (cost: number): boolean => gameRef.current?.canAfford(cost) ?? false;
  const isBuildMenuVisible = showBuildMenu && !selectedBuilding;
  const activeResearchLabel = useMemo(
    () => researchNodes.find(node => node.id === researchState.activeResearchId)?.name ?? 'Idle',
    [researchNodes, researchState.activeResearchId]
  );

  const controlsRight = 16;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <ToastStack items={toasts} />

      <HUD economy={economy} />

      {/* ── Desktop side tabs ───────────────────────────────────────── */}
      <div className="px-side-tabs">
        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--park"
            onClick={() => { setShowParkPanel(v => !v); setShowChallenges(false); setShowResearch(false); }}
          >
            <Landmark />
            MANAGE PARK
          </button>
          {showParkPanel && (
            <div className="px-anim-enter-scale">
              <ParkPanel
                economy={economy}
                localTicketPrice={localTicketPrice}
                onTicketPriceChange={value => setLocalTicketPrice(value)}
                onTicketPriceCommit={handleTicketCommit}
                onToggleParkOpen={isOpen => {
                  gameRef.current?.setParkOpen(isOpen);
                  pushToast('info', isOpen ? 'Park is now OPEN' : 'Park is now CLOSED');
                }}
                activeResearchLabel={activeResearchLabel}
                onClose={() => setShowParkPanel(false)}
              />
            </div>
          )}
        </div>

        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--challenges"
            style={{ position: 'relative' }}
            aria-label="Challenges"
            onClick={() => { setShowChallenges(v => !v); setShowParkPanel(false); setShowResearch(false); }}
          >
            <ScrollText />
            CHALLENGES
            {challenges.some(c => c.completed && !c.claimed) && (
              <span className="px-notif-dot" aria-hidden="true" />
            )}
          </button>
          {showChallenges && (
            <div className="px-anim-enter-scale">
              <ChallengesPanel challenges={challenges} onClose={() => setShowChallenges(false)} />
            </div>
          )}
        </div>

        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--research"
            onClick={() => { setShowResearch(v => !v); setShowParkPanel(false); setShowChallenges(false); }}
          >
            <FlaskConical />
            RESEARCH
          </button>
          {showResearch && (
            <div className="px-anim-enter-scale">
              <ResearchPanel
                nodes={researchNodes}
                state={researchState}
                onStartResearch={id => gameRef.current?.startResearch(id)}
                canAffordResearch={cost => canAfford(cost)}
                onClose={() => setShowResearch(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45 }}>
          {/* Active panel — full width, scrollable, above nav bar */}
          {(showParkPanel || showChallenges || showResearch) && (
            <div className="px-anim-enter-up" style={{ padding: '0 8px 8px', maxHeight: 'calc(100dvh - 160px - var(--safe-bottom))', overflowY: 'auto' }}>
              {showParkPanel && (
                <ParkPanel
                  economy={economy}
                  localTicketPrice={localTicketPrice}
                  onTicketPriceChange={value => setLocalTicketPrice(value)}
                  onTicketPriceCommit={handleTicketCommit}
                  onToggleParkOpen={isOpen => {
                    gameRef.current?.setParkOpen(isOpen);
                    pushToast('info', isOpen ? 'Park is now OPEN' : 'Park is now CLOSED');
                  }}
                  activeResearchLabel={activeResearchLabel}
                  onClose={() => setShowParkPanel(false)}
                />
              )}
              {showChallenges && <ChallengesPanel challenges={challenges} onClose={() => setShowChallenges(false)} />}
              {showResearch && (
                <ResearchPanel
                  nodes={researchNodes}
                  state={researchState}
                  onStartResearch={id => gameRef.current?.startResearch(id)}
                  canAffordResearch={cost => canAfford(cost)}
                  onClose={() => setShowResearch(false)}
                />
              )}
            </div>
          )}
          {/* Nav bar */}
          <div className="px-nav-bar">
            <button
              className={`px-btn px-mobile-tab px-side-tab--park${showParkPanel ? ' px-btn--active' : ''}`}
              aria-label="Manage Park"
              aria-pressed={showParkPanel}
              onClick={() => { setShowParkPanel(v => !v); setShowChallenges(false); setShowResearch(false); }}
            >
              <Landmark size={16} />
              PARK
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--challenges${showChallenges ? ' px-btn--active' : ''}`}
              style={{ position: 'relative' }}
              aria-label="View Challenges"
              aria-pressed={showChallenges}
              onClick={() => { setShowChallenges(v => !v); setShowParkPanel(false); setShowResearch(false); }}
            >
              <ScrollText size={16} />
              GOALS
              {challenges.some(c => c.completed && !c.claimed) && (
                <span className="px-notif-dot" aria-hidden="true" />
              )}
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--research${showResearch ? ' px-btn--active' : ''}`}
              aria-label="Research Buildings"
              aria-pressed={showResearch}
              onClick={() => { setShowResearch(v => !v); setShowParkPanel(false); setShowChallenges(false); }}
            >
              <FlaskConical size={16} />
              RESEARCH
            </button>
          </div>
        </div>
      )}

      {!(isMobile && (showParkPanel || showChallenges || showResearch || isPlacing)) && (
        <div style={{ position: 'fixed', bottom: isMobile ? 'calc(72px + var(--safe-bottom))' : 16, right: controlsRight, display: 'flex', flexDirection: 'row', gap: isMobile ? 6 : 10, zIndex: 40, alignItems: 'center' }}>
          <button
          className="px-btn px-btn--lg"
          aria-label="Place path (free)"
          onClick={() => {
            handleSelectBuilding(getPathDefinition());
            setShowBuildMenu(false);
          }}
        >
          <span className="px-emoji" style={{ fontSize: 22 }}>🛤️</span>
          PATH
        </button>
        <button
          className="px-btn px-btn--lg"
          aria-label="Open build menu"
          aria-expanded={showBuildMenu}
          onClick={() => {
            setShowBuildMenu(value => !value);
            setSelectedBuilding(null);
            setShowHelp(false);
            setActiveBuildDefinition(null);
            if (!showBuildMenu) gameRef.current?.cancelBuildMode();
          }}
        >
          <Hammer />
          BUILD
        </button>
        <button
          className="px-btn"
          style={{ width: isMobile ? 44 : 60, height: isMobile ? 44 : 60, padding: 0, fontSize: 22, justifyContent: 'center', flexShrink: 0 }}
          aria-label="How to play"
          aria-expanded={showHelp}
          onClick={() => {
            setShowHelp(value => !value);
            setShowBuildMenu(false);
          }}
        >
          ?
        </button>
        <button
          className="px-btn"
          style={{ width: isMobile ? 44 : 60, height: isMobile ? 44 : 60, padding: 0, justifyContent: 'center', flexShrink: 0 }}
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          aria-pressed={isMuted}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>
      )}

      {isBuildMenuVisible && (
        <BuildMenu
          onSelectBuilding={handleSelectBuilding}
          onCancel={handleCancelBuildMode}
          canAfford={canAfford}
          unlockedBuildings={researchState.unlocked}
          bottom={isMobile ? 150 : 16}
        />
      )}

      {selectedBuilding && (
        <BuildingPanel
          building={selectedBuilding}
          onClose={handleClosePanel}
          onDelete={handleDeleteBuilding}
          onMove={handleMoveBuilding}
          onPriceChange={handlePriceChange}
        />
      )}

      {isPlacing && activeBuildDefinition && (
        isMobile ? (
          /* Mobile: minimal bar — building name + cancel */
          <div style={{ position: 'fixed', bottom: 90, left: 8, right: 8, zIndex: 46 }}>
            <div className="px-panel px-panel--controls px-anim-enter-up" style={{ padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)' }}>
                    {activeBuildDefinition.icon} {activeBuildDefinition.name.toUpperCase()}
                  </span>
                  {activeBuildDefinition.type !== BuildingType.PATH && activeBuildDefinition.type !== BuildingType.DELETE && (
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'var(--px-muted)' }}>
                      ← SWIPE TO ROTATE →
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {activeBuildDefinition.type === BuildingType.PATH && (
                    <button className="px-btn px-btn--danger" style={{ padding: '6px 10px' }} onClick={() => handleSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Remove a path', cost: 0, icon: '🗑️' })}>
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button className="px-btn" style={{ padding: '6px 10px' }} onClick={handleCancelBuildMode}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop: full info panel */
          <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 45 }}>
            <div className="px-panel px-panel--controls px-anim-enter-up" style={{ padding: 0, width: activeBuildDefinition.type === BuildingType.PATH ? 480 : 420 }}>
              <div className="px-titlebar">
                <span className="px-titlebar__label">
                  <MousePointer2 size={16} />
                  BUILD MODE — {activeBuildDefinition.icon} {activeBuildDefinition.name.toUpperCase()}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {activeBuildDefinition.type === BuildingType.PATH && (
                    <button className="px-btn px-btn--danger" style={{ padding: '8px 14px' }} onClick={() => handleSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Remove a path', cost: 0, icon: '🗑️' })}>
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button className="px-btn" style={{ padding: '8px 14px' }} onClick={handleCancelBuildMode}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <div className="px-chip-row">
                  <div className="px-chip">Cost ${activeBuildDefinition.cost}</div>
                  <div className="px-chip"><RotateCw size={12} /> R to rotate — {buildRotation}°</div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* rotation hint is shown inside the build mode panel on the left */}

      {showHelp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowHelp(false)}
        >
          <div className="px-panel px-scroll-hidden" style={{ maxWidth: 600, width: isMobile ? '100%' : '94%', padding: 0, maxHeight: isMobile ? '100dvh' : '90vh', overflowY: 'auto', overflowX: 'hidden', borderRadius: isMobile ? 0 : undefined }} onClick={e => e.stopPropagation()}>
            <div className="px-titlebar" style={{ fontSize: isMobile ? 10 : undefined }}>HOW TO PLAY</div>
            <div style={{ padding: isMobile ? '12px 14px' : '18px 22px' }}>

              {/* Controls */}
              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>CONTROLS</div>
              {isMobile ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  {[
                    ['1 FINGER DRAG', 'Pan camera'],
                    ['PINCH', 'Zoom in / out'],
                    ['TAP', 'Place or select'],
                    ['TAP + DRAG', 'Draw paths'],
                    ['TAP BUILDING', 'Manage / delete'],
                  ].map(([key, desc]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 6px', background: 'rgba(0,0,0,0.25)' }}>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-green-hi)', flexShrink: 0 }}>{key}</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-text)', textAlign: 'right' }}>{desc}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Press Start 2P', monospace", fontSize: 11, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '52%' }} />
                    <col style={{ width: '48%' }} />
                  </colgroup>
                  <tbody>
                    {[
                      ['RMB DRAG / 1 FINGER', 'Pan camera'],
                      ['SCROLL / PINCH',       'Zoom in / out'],
                      ['LMB / TAP',            'Place or select'],
                      ['LMB DRAG',             'Draw paths'],
                      ['R',                    'Rotate building'],
                      ['RMB / ESC',            'Cancel build mode'],
                      ['CLICK BUILDING',       'Manage / move / delete'],
                    ].map(([key, desc]) => (
                      <tr key={key}>
                        <td style={{ padding: '6px 8px', color: 'var(--px-green-hi)', textShadow: '1px 1px 0 #000', wordBreak: 'break-word' }}>{key}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--px-text)', wordBreak: 'break-word' }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <hr className="px-divider" />

              {/* Goal */}
              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>GOAL</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Build a thriving haunted theme park. Connect rides and shops to the entrance with paths, keep visitors happy, and grow your park rating to 5 stars.
              </div>

              <hr className="px-divider" />

              {/* Visitors */}
              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>VISITORS</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Visitors enter through the gate and pay the entry fee. They wander paths looking for rides and food. Unhappy visitors drag down your Joy and Rating stars.
              </div>

              <hr className="px-divider" />

              {/* Economy */}
              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>ECONOMY</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                <b style={{ color: 'var(--px-gold)' }}>Income</b> from tickets & shops. <b style={{ color: 'var(--px-red)' }}>Expenses</b> are maintenance — rides $4/20s, shops $2/20s.
              </div>

              <hr className="px-divider" />

              {/* Research */}
              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>RESEARCH</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Spend money to unlock new buildings. Research takes time — plan ahead.
              </div>

              <hr className="px-divider" />

              {/* Challenges */}
              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>CHALLENGES</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Complete challenges to earn bonus money. Check them often for guidance on what to build next.
              </div>

              <button className="px-btn" style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: isMobile ? 10 : undefined }} onClick={() => setShowHelp(false)}>
                OK, LET'S BUILD
              </button>
            </div>
          </div>
        </div>
      )}

      {celebration && (
        <div
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, pointerEvents: 'auto' }}
          onClick={() => setCelebration(null)}
        >
          <div className="px-celebration" role="button" aria-label="Dismiss challenge celebration">
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(14px, 4vw, 22px)', color: 'var(--px-gold)', textShadow: '2px 2px 0 #000', lineHeight: 1.6 }}>
              {celebration.title}
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(9px, 2vw, 11px)', color: 'var(--px-green-hi)', marginTop: 12, lineHeight: 1.8 }}>
              {celebration.sub}
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(16px, 4vw, 26px)', color: 'var(--px-green-hi)', textShadow: '2px 2px 0 #000', marginTop: 16 }}>
              +${celebration.reward.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
