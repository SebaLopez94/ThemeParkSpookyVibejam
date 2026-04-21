import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useIsMobile } from './hooks/useIsMobile';
import { FlaskConical, Gem, Hammer, HelpCircle, Landmark, MousePointer2, Route, RotateCw, Trash2, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { Game } from './Game';
import { INITIAL_UNLOCKED_BUILDINGS, getPathDefinition } from './data/buildings';
import { ChallengesPanel } from './ui/ChallengesPanel';
import { BuildMenu } from './ui/BuildMenu';
import { BuildingPanel } from './ui/BuildingPanel';
import { HUD } from './ui/HUD';
import { ParkPanel } from './ui/ParkPanel';
import { ResearchPanel } from './ui/ResearchPanel';
import { BuildingIcon } from './ui/BuildingIcon';
import { LoadingScreen } from './ui/LoadingScreen';
import { MainMenu } from './ui/MainMenu';
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
  const loadInputRef = useRef<HTMLInputElement>(null);

  const [economy, setEconomy] = useState<EconomyState>({
    money: 3500,
    ticketPrice: 2,
    totalVisitors: 0,
    activeVisitors: 0,
    parkRating: 10,
    averageHappiness: 10,
    dailyIncome: 0,
    dailyExpenses: 0,
    maintenancePerMinute: 0,
    netProfit: 0,
    isOpen: true
  });
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuildingInfo | null>(null);
  const [buildRotation, setBuildRotation] = useState(0);
  const [isPlacing, setIsPlacing] = useState(false);
  // Pre-populate with initial unlocked buildings so they show in the build
  // menu immediately â€” the ResearchSystem fires its first notify() before
  const [researchState, setResearchState] = useState<ResearchState>(() => ({
    unlocked: [...INITIAL_UNLOCKED_BUILDINGS],
    completed: [],
    activeResearchId: null,
    remainingTime: 0
  }));
  const [researchNodes, setResearchNodes] = useState<ResearchNode[]>([]);
  const [challenges, setChallenges] = useState<ChallengeState[]>([]);
  const [localTicketPrice, setLocalTicketPrice] = useState(2);
  const [showResearch, setShowResearch] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showParkPanel, setShowParkPanel] = useState(false);
  const [activeBuildDefinition, setActiveBuildDefinition] = useState<BuildingDefinition | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [celebration, setCelebration] = useState<{ title: string; sub: string; reward: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingSave, setIsLoadingSave] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCanvasReady, setGameCanvasReady] = useState(false);
  const [gameLoadProgress, setGameLoadProgress] = useState(0);
  const [pendingSaveData, setPendingSaveData] = useState<unknown | null>(null);

  const pushToast = (tone: ToastItem['tone'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(current => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 2600);
  };

  useEffect(() => {
    if (!gameStarted) return;
    if (!containerRef.current) return;
    setGameCanvasReady(false);

    const game = new Game(containerRef.current);
    gameRef.current = game;

    const { events } = game;
    events.on('economyUpdate', state => setEconomy(state));
    events.on('assetsProgress', progress => setGameLoadProgress(Math.round(progress * 100)));
    events.on('buildingSelected', info => {
      setSelectedBuilding(info);
      if (info !== null) setShowBuildMenu(false);
    });
    events.on('buildCancel', () => {
      setSelectedBuilding(null);
      setShowBuildMenu(false);
      setIsPlacing(false);
      setActiveBuildDefinition(null);
    });
    events.on('rotationChange', degree => setBuildRotation(degree));
    events.on('researchUpdate', state => setResearchState(state));
    events.on('challengesUpdate', state => setChallenges(state));
    events.on('challengeCompleted', challenge => {
      const celebrationIds: Record<string, { title: string; sub: string }> = {
        challenge_first_ride:   { title: 'ðŸŽ¡ FIRST RIDE OPEN!',      sub: 'The crowds are flooding in!' },
        challenge_three_rides:  { title: 'ðŸŽ¢ THRILL PARK UNLOCKED!',  sub: 'Three rides â€” fear is your product.' },
        challenge_rating:       { title: 'â­ FIVE-STAR NIGHTMARE!',   sub: 'The park is legendary.' },
        challenge_visitors_150: { title: 'ðŸ’€ THOUSAND SCREAMS!',     sub: 'Your park is a phenomenon.' },
      };
      const cel = celebrationIds[challenge.id] || { title: `ðŸŽ¯ ${challenge.title.toUpperCase()}`, sub: challenge.description };
      setCelebration({ ...cel, reward: challenge.reward.money });

      confetti({
        particleCount: isMobile ? 60 : 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#d9f99d', '#67e8f9', '#a78bfa']
      });

      window.setTimeout(() => setCelebration(null), 3400);
    });

    setResearchNodes(game.getResearchNodes());

    game.start();

    // If a save file was provided from the main menu, restore it now.
    if (pendingSaveData !== null) {
      try {
        game.importSaveData(pendingSaveData);
        const restored = game.exportSaveData();
        if (restored) setLocalTicketPrice(restored.economy.ticketPrice);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load save file.';
        pushToast('warning', message);
      } finally {
        setPendingSaveData(null);
      }
    }

    return () => {
      gameRef.current = null;
      game.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);

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

  const handleSaveGame = () => {
    const game = gameRef.current;
    if (!game) return;

    try {
      const save = game.exportSaveData();
      const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date(save.savedAt)
        .toISOString()
        .slice(0, 16)
        .replace(/[:T]/g, '-');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `theme-park-vibes-save-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      pushToast('success', 'Save file downloaded.');
    } catch {
      pushToast('warning', 'Could not create save file.');
    }
  };

  const handleLoadGame = () => {
    const game = gameRef.current;
    if (!game) return;
    if (game.hasUserBuiltContent()) {
      const confirmed = window.confirm('Loading a save will replace your current park. Continue?');
      if (!confirmed) return;
    }
    loadInputRef.current?.click();
  };

  const handleLoadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setIsLoadingSave(true);
      await new Promise(resolve => window.setTimeout(resolve, 60));
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      gameRef.current?.importSaveData(parsed);
      const restored = gameRef.current?.exportSaveData();
      if (restored) setLocalTicketPrice(restored.economy.ticketPrice);
      setSelectedBuilding(null);
      setShowBuildMenu(false);
      setIsPlacing(false);
      setActiveBuildDefinition(null);
      pushToast('success', 'Save file loaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load save file.';
      pushToast('warning', message);
      setIsLoadingSave(false);
    }
  };

  const canAfford = (cost: number): boolean => gameRef.current?.canAfford(cost) ?? false;
  const isBuildMenuVisible = showBuildMenu && !selectedBuilding;
  const activeResearchLabel = useMemo(
    () => researchNodes.find(node => node.id === researchState.activeResearchId)?.name ?? 'Idle',
    [researchNodes, researchState.activeResearchId]
  );
  const celebrationTitle = celebration?.title.replace(/^[^A-Za-z0-9]+/u, '').trim() ?? '';

  const controlsRight = 16;

  if (!gameStarted) {
    return (
      <MainMenu
        onNewGame={() => {
          setPendingSaveData(null);
          setGameCanvasReady(false);
          setGameLoadProgress(0);
          setGameStarted(true);
        }}
        onLoadGame={saveData => {
          setPendingSaveData(saveData);
          setGameCanvasReady(false);
          setGameLoadProgress(0);
          setGameStarted(true);
        }}
        onError={msg => pushToast('warning', msg)}
      />
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <input
        ref={loadInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleLoadFile}
      />
      {!gameCanvasReady && (
        <LoadingScreen
          mode="boot"
          progress={gameLoadProgress}
          onDone={() => setGameCanvasReady(true)}
        />
      )}
      {isLoadingSave && <LoadingScreen mode="transition" onDone={() => setIsLoadingSave(false)} />}
      <ToastStack items={toasts} />

      <HUD economy={economy} />

      {/* â”€â”€ Desktop side tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                onSaveGame={handleSaveGame}
                onLoadGame={handleLoadGame}
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
            <Trophy />
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

      {/* â”€â”€ Mobile bottom nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45 }}>
          {/* Active panel â€” full width, scrollable, above nav bar */}
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
                  onSaveGame={handleSaveGame}
                  onLoadGame={handleLoadGame}
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
              onClick={() => { setShowParkPanel(v => !v); setShowChallenges(false); setShowResearch(false); setShowBuildMenu(false); }}
            >
              <Landmark size={16} />
              PARK
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--challenges${showChallenges ? ' px-btn--active' : ''}`}
              style={{ position: 'relative' }}
              aria-label="View Challenges"
              aria-pressed={showChallenges}
              onClick={() => { setShowChallenges(v => !v); setShowParkPanel(false); setShowResearch(false); setShowBuildMenu(false); }}
            >
              <Trophy size={16} />
              GOALS
              {challenges.some(c => c.completed && !c.claimed) && (
                <span className="px-notif-dot" aria-hidden="true" />
              )}
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--research${showResearch ? ' px-btn--active' : ''}`}
              aria-label="Research Buildings"
              aria-pressed={showResearch}
              onClick={() => { setShowResearch(v => !v); setShowParkPanel(false); setShowChallenges(false); setShowBuildMenu(false); }}
            >
              <FlaskConical size={16} />
              RESEARCH
            </button>
          </div>
        </div>
      )}

      {!(isMobile && (showParkPanel || showChallenges || showResearch || showBuildMenu || isPlacing)) && (
        <div style={{ position: 'fixed', bottom: isMobile ? 'calc(72px + var(--safe-bottom))' : 16, right: controlsRight, display: 'flex', flexDirection: 'row', gap: isMobile ? 6 : 10, zIndex: 40, alignItems: 'center' }}>
          {!isBuildMenuVisible && (
            <>
              <button
                className="px-btn px-btn--lg"
                aria-label="Place path (free)"
                onClick={() => {
                  handleSelectBuilding(getPathDefinition());
                  setShowBuildMenu(false);
                }}
              >
                <Route />
                PATH
              </button>
              <button
                className="px-btn px-btn--lg"
                aria-label="Open build menu"
                aria-expanded={showBuildMenu}
                onClick={() => {
                  const opening = !showBuildMenu;
                  setShowBuildMenu(opening);
                  setSelectedBuilding(null);
                  setShowHelp(false);
                  setActiveBuildDefinition(null);
                  if (opening) {
                    setShowParkPanel(false);
                    setShowChallenges(false);
                    setShowResearch(false);
                  } else {
                    gameRef.current?.cancelBuildMode();
                  }
                }}
              >
                <Hammer />
                BUILD
              </button>
            </>
          )}
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
            <HelpCircle />
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
          bottom={isMobile ? 'calc(68px + var(--safe-bottom))' : 16}
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
          /* Mobile: build bar with tap-to-rotate button */
          <div style={{ position: 'fixed', bottom: 90, left: 8, right: 8, zIndex: 46 }}>
            <div className="px-panel px-panel--controls px-anim-enter-up" style={{ padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
                {/* Building name */}
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)', display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <BuildingIcon type={activeBuildDefinition.type} subType={activeBuildDefinition.subType} size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeBuildDefinition.name.toUpperCase()}
                  </span>
                </span>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {activeBuildDefinition.type === BuildingType.PATH ? (
                    <button
                      className="px-btn px-btn--danger"
                      style={{ padding: '8px 12px' }}
                      aria-label="Delete path tile"
                      onClick={() => handleSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Remove a path', cost: 0, icon: '🗑️' })}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    /* Tap to rotate 90 degrees CW - shows current angle */
                    <button
                      className="px-btn"
                      style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}
                      aria-label={`Rotate building, currently ${buildRotation} degrees`}
                      onClick={() => gameRef.current?.rotateBuilding()}
                    >
                      <RotateCw size={14} />
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'var(--px-muted)', lineHeight: 1 }}>
                        {buildRotation}&deg;
                      </span>
                    </button>
                  )}

                  <button
                    className="px-btn"
                    style={{ padding: '8px 12px' }}
                    aria-label="Cancel build mode"
                    onClick={handleCancelBuildMode}
                  >
                    <X size={14} />
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    BUILD MODE
                    <BuildingIcon type={activeBuildDefinition.type} subType={activeBuildDefinition.subType} size={16} />
                    {activeBuildDefinition.name.toUpperCase()}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {activeBuildDefinition.type === BuildingType.PATH && (
                    <button className="px-btn px-btn--danger" style={{ padding: '8px 14px' }} onClick={() => handleSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Remove a path', cost: 0, icon: 'ðŸ—‘ï¸' })}>
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
                  <div className="px-chip"><RotateCw size={12} /> R to rotate â€” {buildRotation}Â°</div>
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

              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>CONTROLS</div>
              {isMobile ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  {[
                    ['1 FINGER DRAG', 'Move camera'],
                    ['PINCH', 'Zoom in or out'],
                    ['TAP', 'Build or select'],
                    ['TAP + DRAG', 'Draw paths'],
                    ['TAP BUILDING', 'Manage it'],
                    ['SWIPE BUILD BAR', 'Rotate building'],
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
                      ['RMB DRAG / 1 FINGER', 'Move camera'],
                      ['SCROLL / PINCH', 'Zoom in or out'],
                      ['LMB / TAP', 'Build or select'],
                      ['LMB DRAG', 'Draw paths'],
                      ['R', 'Rotate building'],
                      ['RMB / ESC', 'Cancel build mode'],
                      ['CLICK BUILDING', 'Manage, move, or delete'],
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

              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>START HERE</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {[
                  'Build paths from the entrance so guests can reach your park.',
                  'Place one ride first, then add food, drinks, and toilets nearby.',
                  'Open the park and expand only when income feels stable.',
                ].map(step => (
                  <div key={step} className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.75 : undefined, padding: '7px 9px', background: 'rgba(0,0,0,0.22)' }}>
                    {step}
                  </div>
                ))}
              </div>

              <hr className="px-divider" />

              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>KEEP GUESTS HAPPY</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                {[
                  ['FUN', 'Build more rides'],
                  ['HUNGER', 'Add burger stalls'],
                  ['THIRST', 'Add drink stands'],
                  ['HYGIENE', 'Add toilets'],
                ].map(([need, desc]) => (
                  <div key={need} style={{ padding: '5px 7px', background: 'rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'var(--px-green-hi)' }}>{need}</span>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'var(--px-text)' }}>{desc}</span>
                  </div>
                ))}
              </div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Guests spend money when they find what they need. If their needs stay low for too long, they leave and your rating drops.
              </div>

              <hr className="px-divider" />

              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>BUILD SMART</div>
              <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                {[
                  'Rides need path access or guests will ignore them.',
                  'Stronger rides support higher prices and satisfy fun faster.',
                  'Decorations near rides improve guest mood and park appeal.',
                ].map(item => (
                  <div key={item} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.25)' }}>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'var(--px-text)', lineHeight: 1.7 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <hr className="px-divider" />

              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>MONEY</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Money comes from entry tickets, rides, and shops. Expenses come from maintenance, so avoid building too much too early.
              </div>

              <hr className="px-divider" />

              <div className="px-label" style={{ marginBottom: 6, fontSize: isMobile ? 9 : undefined }}>PROGRESSION</div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined }}>
                Use Research to unlock stronger buildings. Use Challenges for direction and bonus money.
              </div>

              <div className="px-body" style={{ fontSize: isMobile ? 10 : undefined, lineHeight: isMobile ? 1.8 : undefined, marginTop: 14, color: 'var(--px-green-hi)' }}>
                Goal: keep guests happy, grow your park, and reach 5 stars.
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                color: 'var(--px-gold)',
                marginBottom: 10
              }}
            >
              <Gem size={28} strokeWidth={2.3} />
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(14px, 4vw, 22px)', color: 'var(--px-gold)', textShadow: '2px 2px 0 #000', lineHeight: 1.6 }}>
              {celebrationTitle}
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
