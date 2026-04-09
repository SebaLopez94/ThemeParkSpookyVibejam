import { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Hammer, Landmark, MousePointer2, RotateCw, ScrollText, XCircle } from 'lucide-react';
import { Game } from './Game';
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
    money: 20000,
    ticketPrice: 10,
    totalVisitors: 0,
    activeVisitors: 0,
    parkRating: 50,
    averageHappiness: 50,
    dailyIncome: 0,
    dailyExpenses: 0,
    netProfit: 0
  });
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuildingInfo | null>(null);
  const [buildRotation, setBuildRotation] = useState(0);
  const [isPlacing, setIsPlacing] = useState(false);
  const [researchState, setResearchState] = useState<ResearchState>({
    unlocked: [],
    completed: [],
    activeResearchId: null,
    remainingTime: 0
  });
  const [researchNodes, setResearchNodes] = useState<ResearchNode[]>([]);
  const [challenges, setChallenges] = useState<ChallengeState[]>([]);
  const [localTicketPrice, setLocalTicketPrice] = useState(10);
  const [showResearch, setShowResearch] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showParkPanel, setShowParkPanel] = useState(false);
  const [activeBuildDefinition, setActiveBuildDefinition] = useState<BuildingDefinition | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
      setLocalTicketPrice(state.ticketPrice);
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

      <div className="px-side-tabs">
        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--park"
            onClick={() => setShowParkPanel(value => !value)}
          >
            <Landmark />
            {showParkPanel ? 'HIDE PARK' : 'SHOW PARK'}
          </button>
          {showParkPanel && (
            <ParkPanel
              economy={economy}
              localTicketPrice={localTicketPrice}
              onTicketPriceChange={value => setLocalTicketPrice(value)}
              onTicketPriceCommit={handleTicketCommit}
              activeResearchLabel={activeResearchLabel}
            />
          )}
        </div>

        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--challenges"
            onClick={() => setShowChallenges(value => !value)}
          >
            <ScrollText />
            {showChallenges ? 'HIDE CHALLENGES' : 'SHOW CHALLENGES'}
          </button>
          {showChallenges && <ChallengesPanel challenges={challenges} />}
        </div>

        <div className="px-side-tab-column">
          <button
            className="px-btn px-side-tab px-side-tab--research"
            onClick={() => setShowResearch(value => !value)}
          >
            <FlaskConical />
            {showResearch ? 'HIDE RESEARCH' : 'SHOW RESEARCH'}
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

      <div style={{ position: 'fixed', bottom: 16, right: controlsRight, display: 'flex', flexDirection: 'row', gap: 10, zIndex: 40, alignItems: 'center' }}>
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
          style={{ width: 60, height: 60, padding: 0, fontSize: 22, justifyContent: 'center', flexShrink: 0 }}
          onClick={() => {
            setShowHelp(value => !value);
            setShowBuildMenu(false);
          }}
        >
          ?
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
        <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 45 }}>
          <div className="px-panel px-panel--controls" style={{ padding: 0, width: 420 }}>
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
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-muted)', lineHeight: 1.8 }}>
                    Left click to place on a valid tile.
                  </div>
                </div>
                <div className="px-stat" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RotateCw size={14} color="var(--px-cyan)" />
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-muted)', lineHeight: 1.8 }}>
                    Press `R` to rotate. Current rotation: {buildRotation}°
                  </div>
                </div>
                <div className="px-stat" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <XCircle size={14} color="var(--px-red)" />
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-muted)', lineHeight: 1.8 }}>
                    Cancel with right click or `Esc`.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPlacing && !selectedBuilding && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 40 }}>
          <div className="px-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: 'var(--px-muted)' }}>[R] ROTATE</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 15, color: 'var(--px-green-hi)', minWidth: 48, textAlign: 'right' }}>
              {buildRotation}°
            </span>
          </div>
        </div>
      )}

      {showHelp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowHelp(false)}
        >
          <div className="px-panel" style={{ maxWidth: 560, width: '92%', padding: 0 }} onClick={event => event.stopPropagation()}>
            <div className="px-titlebar">HOW TO PLAY</div>
            <div style={{ padding: '18px 22px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Press Start 2P', monospace", fontSize: 10 }}>
                <tbody>
                  {[
                    ['RMB + DRAG', 'Pan camera'],
                    ['SCROLL', 'Zoom in / out'],
                    ['LMB', 'Place / select'],
                    ['LMB DRAG', 'Draw paths'],
                    ['RMB', 'Cancel build'],
                    ['CLICK BLDG', 'Manage building']
                  ].map(([key, description]) => (
                    <tr key={key}>
                      <td style={{ padding: '7px 8px', color: 'var(--px-green-hi)', textShadow: '1px 1px 0 #000' }}>{key}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--px-text)' }}>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="px-divider" />
              <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-muted)', lineHeight: 2, marginTop: 8 }}>
                Build connected paths from the entrance, keep prices fair, and unlock stronger attractions through research.
              </p>
              <button className="px-btn" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => setShowHelp(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
