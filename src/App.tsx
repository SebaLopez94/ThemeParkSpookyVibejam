import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from './hooks/useIsMobile';
import { FlaskConical, Hammer, Landmark, MousePointer2, RotateCw, ScrollText, Volume2, VolumeX, XCircle } from 'lucide-react';
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
    money: 5000,
    ticketPrice: 10,
    totalVisitors: 0,
    activeVisitors: 0,
    parkRating: 10,
    averageHappiness: 10,
    dailyIncome: 0,
    dailyExpenses: 0,
    netProfit: 0
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
  const [localTicketPrice, setLocalTicketPrice] = useState(10);
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
        challenge_first_ride:  { title: '🎡 FIRST RIDE OPEN!',     sub: 'The crowds are flooding in!' },
        challenge_three_rides: { title: '🎢 THRILL PARK UNLOCKED!', sub: 'Three rides — fear is your product.' },
        challenge_rating:      { title: '⭐ FIVE-STAR NIGHTMARE!',  sub: 'The park is legendary.' },
        challenge_visitors_150:{ title: '💀 THOUSAND SCREAMS!',    sub: 'Your park is a phenomenon.' },
      };
      const cel = celebrationIds[challenge.id];
      if (cel) {
        setCelebration({ ...cel, reward: challenge.reward.money });
        window.setTimeout(() => setCelebration(null), 3800);
      }
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

  const handleSelectBuilding = (definition: BuildingDefinition) => {
    gameRef.current?.selectBuilding(definition);
    setShowBuildMenu(false);
    setSelectedBuilding(null);
    setIsPlacing(true);
    setBuildRotation(0);
    setActiveBuildDefinition(definition);
    pushToast('info', `Placing ${definition.name}. Left click to build, Esc or right click to cancel.`);
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
      cost: info.buildCost,
      icon: info.icon
    });
    pushToast('info', `Moving ${info.name}. Choose a new valid tile.`);
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

  const isMobile = useIsMobile();
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
            />
          )}
        </div>

        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--challenges"
            onClick={() => setShowChallenges(v => !v)}
          >
            <ScrollText />
            CHALLENGES
          </button>
          {showChallenges && <ChallengesPanel challenges={challenges} />}
        </div>

        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--research"
            onClick={() => setShowResearch(v => !v)}
          >
            <FlaskConical />
            RESEARCH
          </button>
          {showResearch && (
            <ResearchPanel
              nodes={researchNodes}
              state={researchState}
              onStartResearch={id => gameRef.current?.startResearch(id)}
              canAffordResearch={cost => canAfford(cost)}
            />
          )}
        </div>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45 }}>
          {/* Active panel — full width, scrollable, above nav bar */}
          {(showParkPanel || showChallenges || showResearch) && (
            <div style={{ padding: '0 8px 8px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
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
                />
              )}
              {showChallenges && <ChallengesPanel challenges={challenges} />}
              {showResearch && (
                <ResearchPanel
                  nodes={researchNodes}
                  state={researchState}
                  onStartResearch={id => gameRef.current?.startResearch(id)}
                  canAffordResearch={cost => canAfford(cost)}
                />
              )}
            </div>
          )}
          {/* Nav bar */}
          <div style={{ display: 'flex', gap: 6, padding: '0 8px 8px', background: 'rgba(10,5,20,0.85)' }}>
            <button
              className={`px-btn px-mobile-tab px-side-tab--park${showParkPanel ? ' px-btn--active' : ''}`}
              onClick={() => { setShowParkPanel(v => !v); setShowChallenges(false); setShowResearch(false); }}
            >
              <Landmark size={16} />
              PARK
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--challenges${showChallenges ? ' px-btn--active' : ''}`}
              onClick={() => { setShowChallenges(v => !v); setShowParkPanel(false); setShowResearch(false); }}
            >
              <ScrollText size={16} />
              GOALS
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--research${showResearch ? ' px-btn--active' : ''}`}
              onClick={() => { setShowResearch(v => !v); setShowParkPanel(false); setShowChallenges(false); }}
            >
              <FlaskConical size={16} />
              RESEARCH
            </button>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: isMobile ? 80 : 16, right: controlsRight, display: 'flex', flexDirection: 'row', gap: isMobile ? 6 : 10, zIndex: 40, alignItems: 'center' }}>
        <button
          className="px-btn px-btn--lg"
          title="Place path (free)"
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
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>

      {isBuildMenuVisible && (
        <BuildMenu
          onSelectBuilding={handleSelectBuilding}
          onCancel={handleCancelBuildMode}
          canAfford={canAfford}
          unlockedBuildings={researchState.unlocked}
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
        <div style={{ position: 'fixed', bottom: isMobile ? 70 : 16, left: isMobile ? 8 : 16, right: isMobile ? 8 : 'auto', zIndex: 45 }}>
          <div className="px-panel px-panel--controls" style={{ padding: 0, width: isMobile ? '100%' : 420 }}>
            <div className="px-titlebar">
              <span className="px-titlebar__label">
                <MousePointer2 size={16} />
                BUILD MODE
              </span>
              <span style={{ fontSize: 10 }}>{activeBuildDefinition.icon} {activeBuildDefinition.name.toUpperCase()}</span>
            </div>
            <div style={{ padding: '12px 16px 16px' }}>
              <div className="px-chip-row">
                <div className="px-chip">{activeBuildDefinition.icon} {activeBuildDefinition.name}</div>
                <div className="px-chip">Cost ${activeBuildDefinition.cost}</div>
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div className="px-stat" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MousePointer2 size={14} color="var(--px-green-hi)" />
                  <div className="px-body">Left click to place on a valid tile.</div>
                </div>
                <div className="px-stat" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RotateCw size={14} color="var(--px-cyan)" />
                  <div className="px-body">Press R to rotate — current: {buildRotation}°</div>
                </div>
                <div className="px-stat" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <XCircle size={14} color="var(--px-red)" />
                  <div className="px-body">Right click or Esc to cancel.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* rotation hint is shown inside the build mode panel on the left */}

      {showHelp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowHelp(false)}
        >
          <div className="px-panel" style={{ maxWidth: 600, width: '94%', padding: 0, maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="px-titlebar">HOW TO PLAY</div>
            <div style={{ padding: '18px 22px' }}>

              {/* Controls */}
              <div className="px-label" style={{ marginBottom: 8 }}>CONTROLS</div>
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

              <hr className="px-divider" />

              {/* Goal */}
              <div className="px-label" style={{ marginBottom: 8 }}>GOAL</div>
              <div className="px-body">
                Build a thriving haunted theme park. Connect rides and shops to the entrance with paths, keep visitors happy, and grow your park rating to 5 stars.
              </div>

              <hr className="px-divider" />

              {/* Visitors */}
              <div className="px-label" style={{ marginBottom: 8 }}>VISITORS</div>
              <div className="px-body">
                Visitors enter through the gate and pay the entry ticket price. They wander paths looking for rides, food, and restrooms. If their needs aren't met they leave unhappy — dragging down your Joy and Rating stars.
              </div>

              <hr className="px-divider" />

              {/* Economy */}
              <div className="px-label" style={{ marginBottom: 8 }}>ECONOMY</div>
              <div className="px-body">
                <b style={{ color: 'var(--px-gold)' }}>Income</b> comes from entry tickets and building prices. <b style={{ color: 'var(--px-red)' }}>Expenses</b> are recurring maintenance costs — rides cost $2/s, shops and services $1/s. Keep net profit positive to grow sustainably.
              </div>

              <hr className="px-divider" />

              {/* Research */}
              <div className="px-label" style={{ marginBottom: 8 }}>RESEARCH</div>
              <div className="px-body">
                Spend money to research new buildings. Some unlock advanced rides that attract more visitors and boost your rating. Research takes time — plan ahead.
              </div>

              <hr className="px-divider" />

              {/* Challenges */}
              <div className="px-label" style={{ marginBottom: 8 }}>CHALLENGES</div>
              <div className="px-body">
                Complete challenges to earn bonus money and rating boosts. They range from starter goals to legendary feats — check them often for guidance on what to build next.
              </div>

              <button className="px-btn" style={{ marginTop: 18, width: '100%', justifyContent: 'center' }} onClick={() => setShowHelp(false)}>
                OK, LET'S BUILD
              </button>
            </div>
          </div>
        </div>
      )}

      {celebration && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, pointerEvents: 'none'
        }}>
          <div style={{ animation: 'px-celebrate 0.35s cubic-bezier(0.22,1,0.36,1) both', textAlign: 'center' }}>
            <div style={{
              background: 'linear-gradient(180deg, #2d1a00 0%, #1a0d00 100%)',
              border: '4px solid #f59e0b',
              boxShadow: '0 0 40px rgba(251,191,36,0.5), 6px 6px 0 #000',
              padding: '28px 48px',
              maxWidth: '90vw'
            }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(14px, 4vw, 22px)', color: '#fbbf24', textShadow: '2px 2px 0 #000', lineHeight: 1.6 }}>
                {celebration.title}
              </div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(9px, 2vw, 11px)', color: '#d9f99d', marginTop: 12, lineHeight: 1.8 }}>
                {celebration.sub}
              </div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(16px, 4vw, 26px)', color: '#4ade80', textShadow: '2px 2px 0 #000', marginTop: 16 }}>
                +${celebration.reward.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
