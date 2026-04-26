import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useIsMobile } from './hooks/useIsMobile';
import {
  FlaskConical,
  Gem,
  Hammer,
  HelpCircle,
  MousePointer2,
  RollerCoaster,
  RotateCw,
  Route,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { Game } from './Game';
import { INITIAL_UNLOCKED_BUILDINGS, getPathDefinition } from './data/buildings';
import { ChallengesPanel } from './ui/ChallengesPanel';
import { BuildMenu } from './ui/BuildMenu';
import { BuildingPanel } from './ui/BuildingPanel';
import { HUD } from './ui/HUD';
import { ParkPanel } from './ui/ParkPanel';
import { ResearchPanel } from './ui/ResearchPanel';
import { BuildingIcon } from './ui/BuildingIcon';
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
  const mobilePanelSwipeStartRef = useRef<{ y: number; fromTop: boolean } | null>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const mobilePanelCloseTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

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
  const [mobilePanelDragY, setMobilePanelDragY] = useState(0);
  const [isMobilePanelDragging, setIsMobilePanelDragging] = useState(false);
  const [isMobilePanelClosing, setIsMobilePanelClosing] = useState(false);
  const [activeBuildDefinition, setActiveBuildDefinition] = useState<BuildingDefinition | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [celebration, setCelebration] = useState<{ title: string; sub: string; reward: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
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

    const game = new Game(containerRef.current);
    gameRef.current = game;

    const { events } = game;
    events.on('economyUpdate', state => setEconomy(state));
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
    events.on('buildingPlaced', () => {
      if (!isMobile) return;
      game.cancelBuildMode();
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

  useEffect(() => {
    return () => {
      if (mobilePanelCloseTimerRef.current) window.clearTimeout(mobilePanelCloseTimerRef.current);
    };
  }, []);

  const isMobile = useIsMobile();

  const handleSelectBuilding = (definition: BuildingDefinition) => {
    gameRef.current?.selectBuilding(definition);
    setShowBuildMenu(false);
    setSelectedBuilding(null);
    setIsPlacing(true);
    setBuildRotation(0);
    setActiveBuildDefinition(definition);
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
  };

  const handlePriceChange = (position: GridPosition, newPrice: number) => {
    gameRef.current?.updateBuildingPrice(position, newPrice);
  };

  const handleTicketCommit = () => {
    const clamped = Math.max(0, Math.min(50, Math.round(localTicketPrice)));
    setLocalTicketPrice(clamped);
    gameRef.current?.setTicketPrice(clamped);
  };

  const handleToggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    gameRef.current?.setMuted(newState);
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
    }
  };

  const canAfford = (cost: number): boolean => gameRef.current?.canAfford(cost) ?? false;
  const isBuildMenuVisible = showBuildMenu && !selectedBuilding;
  const shouldShowHud = !(isMobile && isBuildMenuVisible);
  const activeResearchLabel = useMemo(
    () => researchNodes.find(node => node.id === researchState.activeResearchId)?.name ?? 'Idle',
    [researchNodes, researchState.activeResearchId]
  );
  const celebrationTitle = celebration?.title.replace(/^[^A-Za-z0-9]+/u, '').trim() ?? '';

  const controlsRight = 16;
  const activeMobilePanel = showParkPanel ? 'park' : showChallenges ? 'challenges' : showResearch ? 'research' : null;
  const activeMobileSheet = isBuildMenuVisible ? 'build' : activeMobilePanel;
  const mobileFullscreenPanelStyle = {
    height: 'calc(100dvh - 56px - var(--safe-bottom))',
    maxHeight: 'calc(100dvh - 56px - var(--safe-bottom))',
    borderRadius: 0,
  };
  const resetMobilePanelMotion = () => {
    setMobilePanelDragY(0);
    setIsMobilePanelDragging(false);
    setIsMobilePanelClosing(false);
    if (mobilePanelCloseTimerRef.current) {
      window.clearTimeout(mobilePanelCloseTimerRef.current);
      mobilePanelCloseTimerRef.current = null;
    }
  };
  const clearMobileOverlayPanels = () => {
    setShowParkPanel(false);
    setShowChallenges(false);
    setShowResearch(false);
  };
  const getMobileSheetCloseDistance = () => {
    if (activeMobileSheet === 'build') {
      return mobileSheetRef.current?.getBoundingClientRect().height ?? window.innerHeight;
    }
    return window.innerHeight;
  };
  const closeMobileOverlayPanels = () => {
    if (!activeMobileSheet) return;
    const sheetToClose = activeMobileSheet;
    setIsMobilePanelDragging(false);
    setIsMobilePanelClosing(true);
    window.requestAnimationFrame(() => {
      setMobilePanelDragY(getMobileSheetCloseDistance());
    });
    if (mobilePanelCloseTimerRef.current) window.clearTimeout(mobilePanelCloseTimerRef.current);
    mobilePanelCloseTimerRef.current = window.setTimeout(() => {
      if (sheetToClose === 'build') {
        handleCancelBuildMode();
      } else {
        clearMobileOverlayPanels();
      }
      setMobilePanelDragY(0);
      setIsMobilePanelDragging(false);
      setIsMobilePanelClosing(false);
      mobilePanelCloseTimerRef.current = null;
    }, 240);
  };
  const openMobilePanel = (panel: 'park' | 'challenges' | 'research') => {
    if (activeMobilePanel === panel) {
      closeMobileOverlayPanels();
      return;
    }
    resetMobilePanelMotion();
    setShowParkPanel(panel === 'park');
    setShowChallenges(panel === 'challenges');
    setShowResearch(panel === 'research');
    setShowBuildMenu(false);
  };
  const mobileSheetTouchHandlers = {
    onTouchStart: (event: any) => {
      const touch = event.touches[0];
      if (!touch) return;
      const rect = event.currentTarget.getBoundingClientRect();
      mobilePanelSwipeStartRef.current = {
        y: touch.clientY,
        fromTop: touch.clientY - rect.top <= 72,
      };
      setIsMobilePanelDragging(false);
    },
    onTouchMove: (event: any) => {
      const start = mobilePanelSwipeStartRef.current;
      const touch = event.touches[0];
      if (!start || !touch || !start.fromTop) return;
      const deltaY = touch.clientY - start.y;
      setIsMobilePanelDragging(true);
      const maxDrag = getMobileSheetCloseDistance();
      const nextDragY = Math.max(0, Math.min(maxDrag, deltaY));
      setMobilePanelDragY(nextDragY);
    },
    onTouchEnd: (event: any) => {
      const start = mobilePanelSwipeStartRef.current;
      mobilePanelSwipeStartRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch || !start.fromTop) return;
      if (touch.clientY - start.y > 86) {
        closeMobileOverlayPanels();
      } else {
        setIsMobilePanelDragging(false);
        setMobilePanelDragY(0);
      }
    },
  };
  const mobileSheetClassName = `px-mobile-panel-sheet${activeMobileSheet === 'build' ? ' px-mobile-panel-sheet--build' : ''}${isMobilePanelClosing ? ' px-mobile-panel-sheet--closing' : ''}${isMobilePanelDragging ? ' px-mobile-panel-sheet--dragging' : ''}`;
  const mobileSheetDragStyle = {
    transform: mobilePanelDragY > 0 ? `translateY(${mobilePanelDragY}px)` : undefined,
  };

  if (!gameStarted) {
    return (
      <MainMenu
        onNewGame={() => {
          setPendingSaveData(null);
          setGameStarted(true);
        }}
        onLoadGame={saveData => {
          setPendingSaveData(saveData);
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
      <ToastStack items={toasts} />

      {shouldShowHud && <HUD economy={economy} />}

      {/* â”€â”€ Desktop side tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* ── Desktop icon dock ──────────────────────────────────────────── */}
      <div className="px-icon-dock">
        <button
          className={`px-dock-btn px-dock-btn--park${showParkPanel ? ' px-dock-btn--active' : ''}`}
          title="Manage Park"
          aria-label="Manage Park"
          onClick={() => { setShowParkPanel(v => !v); setShowChallenges(false); setShowResearch(false); }}
        >
          <RollerCoaster size={20} />
          <span className="px-dock-btn__label">PARK</span>
        </button>
        <button
          className={`px-dock-btn px-dock-btn--challenges${showChallenges ? ' px-dock-btn--active' : ''}`}
          title="Challenges"
          aria-label="Challenges"
          style={{ position: 'relative' }}
          onClick={() => { setShowChallenges(v => !v); setShowParkPanel(false); setShowResearch(false); }}
        >
          <Trophy size={20} />
          <span className="px-dock-btn__label">GOALS</span>
          {challenges.some(c => c.completed && !c.claimed) && (
            <span className="px-notif-dot" aria-hidden="true" />
          )}
        </button>
        <button
          className={`px-dock-btn px-dock-btn--research${showResearch ? ' px-dock-btn--active' : ''}`}
          title="Research"
          aria-label="Research"
          onClick={() => { setShowResearch(v => !v); setShowParkPanel(false); setShowChallenges(false); }}
        >
          <FlaskConical size={20} />
          <span className="px-dock-btn__label">LAB</span>
        </button>
      </div>

      {/* ── Desktop panels ─────────────────────────────────────────────── */}
      {showParkPanel && (
        <div className="px-dock-panel px-dock-panel--park px-anim-enter-scale">
          <ParkPanel
            economy={economy}
            localTicketPrice={localTicketPrice}
            onTicketPriceChange={value => setLocalTicketPrice(value)}
            onTicketPriceCommit={handleTicketCommit}
            onToggleParkOpen={isOpen => {
              gameRef.current?.setParkOpen(isOpen);
            }}
            onSaveGame={handleSaveGame}
            onLoadGame={handleLoadGame}
            activeResearchLabel={activeResearchLabel}
            onClose={() => setShowParkPanel(false)}
          />
        </div>
      )}
      {showChallenges && (
        <div className="px-dock-panel px-dock-panel--challenges px-anim-enter-scale">
          <ChallengesPanel challenges={challenges} onClose={() => setShowChallenges(false)} />
        </div>
      )}
      {showResearch && (
        <div className="px-dock-panel px-dock-panel--research px-anim-enter-scale">
          <ResearchPanel
            nodes={researchNodes}
            state={researchState}
            onStartResearch={id => gameRef.current?.startResearch(id)}
            canAffordResearch={cost => canAfford(cost)}
            onClose={() => setShowResearch(false)}
          />
        </div>
      )}

      {/* â”€â”€ Mobile bottom nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 95 }}>
          {/* Active panel — fullscreen on mobile */}
          {(showParkPanel || showChallenges || showResearch) && (
            <div
              ref={mobileSheetRef}
              className={mobileSheetClassName}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 'calc(56px + var(--safe-bottom))',
                zIndex: 80,
                ...mobileSheetDragStyle,
              }}
              {...mobileSheetTouchHandlers}
            >
              <div className="px-mobile-panel-content">
              {showParkPanel && (
                <ParkPanel
                  style={mobileFullscreenPanelStyle}
                  economy={economy}
                  localTicketPrice={localTicketPrice}
                  onTicketPriceChange={value => setLocalTicketPrice(value)}
                  onTicketPriceCommit={handleTicketCommit}
                  onToggleParkOpen={isOpen => {
                    gameRef.current?.setParkOpen(isOpen);
                  }}
                  onSaveGame={handleSaveGame}
                  onLoadGame={handleLoadGame}
                  activeResearchLabel={activeResearchLabel}
                  onClose={closeMobileOverlayPanels}
                />
              )}
              {showChallenges && (
                <ChallengesPanel
                  challenges={challenges}
                  style={mobileFullscreenPanelStyle}
                  onClose={closeMobileOverlayPanels}
                />
              )}
              {showResearch && (
                <ResearchPanel
                  style={mobileFullscreenPanelStyle}
                  nodes={researchNodes}
                  state={researchState}
                  onStartResearch={id => gameRef.current?.startResearch(id)}
                  canAffordResearch={cost => canAfford(cost)}
                  onClose={closeMobileOverlayPanels}
                />
              )}
              </div>
            </div>
          )}
          {/* Nav bar */}
          <div className="px-nav-bar" style={{ position: 'relative', zIndex: 90 }}>
            <button
              className={`px-btn px-mobile-tab px-side-tab--park${showParkPanel ? ' px-btn--active' : ''}`}
              onClick={() => openMobilePanel('park')}
            >
              <RollerCoaster size={16} />
              PARK
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--challenges${showChallenges ? ' px-btn--active' : ''}`}
              style={{ position: 'relative' }}
              onClick={() => openMobilePanel('challenges')}
            >
              <Trophy size={16} />
              GOALS
              {challenges.some(c => c.completed && !c.claimed) && (
                <span className="px-notif-dot" aria-hidden="true" />
              )}
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--research${showResearch ? ' px-btn--active' : ''}`}
              onClick={() => openMobilePanel('research')}
            >
              <FlaskConical size={16} />
              RESEARCH
            </button>
          </div>
        </div>
      )}

      {!(isMobile && (showParkPanel || showChallenges || showResearch || showBuildMenu || isPlacing)) && (
        <div className={`px-controls-bar${isMobile ? ' px-controls-bar--mobile' : ''}`}>
          {!isBuildMenuVisible && (
            <>
              <button
                className="px-btn px-btn--lg"
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
                onClick={() => {
                  const opening = !showBuildMenu;
                  resetMobilePanelMotion();
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
              <div className="px-controls-bar__divider" />
            </>
          )}
          <button
            className="px-btn px-icon-btn"
            title="How to play"
            onClick={() => {
              setShowHelp(value => !value);
              setShowBuildMenu(false);
            }}
          >
            <HelpCircle size={18} />
          </button>
          <button
            className="px-btn px-icon-btn"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}

      {isBuildMenuVisible && (
        <BuildMenu
          onSelectBuilding={handleSelectBuilding}
          onCancel={isMobile ? closeMobileOverlayPanels : handleCancelBuildMode}
          canAfford={canAfford}
          unlockedBuildings={researchState.unlocked}
          bottom={isMobile ? 'calc(68px + var(--safe-bottom))' : 16}
          mobileSheetClassName={mobileSheetClassName}
          mobileSheetStyle={mobileSheetDragStyle}
          mobileSheetHandlers={mobileSheetTouchHandlers}
          mobileSheetRef={mobileSheetRef}
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
                  ) : activeBuildDefinition.type !== BuildingType.DELETE ? (
                    /* Tap to rotate 90 degrees CW - shows current angle */
                    <button
                      type="button"
                      className="px-btn"
                      style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}
                      aria-label={`Rotate building, currently ${buildRotation} degrees`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        gameRef.current?.rotateBuilding();
                      }}
                    >
                      <RotateCw size={14} />
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'var(--px-muted)', lineHeight: 1 }}>
                        {buildRotation}&deg;
                      </span>
                    </button>
                  ) : null}

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
                  {activeBuildDefinition.type !== BuildingType.PATH && activeBuildDefinition.type !== BuildingType.DELETE ? (
                    <>
                      <div className="px-chip">Cost ${activeBuildDefinition.cost}</div>
                      <div className="px-chip"><RotateCw size={12} /> R to rotate â€” {buildRotation}Â°</div>
                    </>
                  ) : (
                    <div className="px-chip">
                      {activeBuildDefinition.type === BuildingType.DELETE ? 'Click paths to delete' : 'Draw paths with click and drag'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* rotation hint is shown inside the build mode panel on the left */}

      {showHelp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowHelp(false)}
        >
          {isMobile ? (
            /* ── MOBILE HELP ───────────────────────────────────────────── */
            <div className="px-panel px-panel--help px-scroll-hidden" style={{ width: '100%', padding: 0, maxHeight: '100dvh', overflowY: 'auto', overflowX: 'hidden', borderRadius: 0 }} onClick={e => e.stopPropagation()}>
              <div className="px-titlebar" style={{ fontSize: 10 }}>HOW TO PLAY</div>
              <div style={{ padding: '14px 14px 20px' }}>

                {/* Controls */}
                <div className="px-label" style={{ fontSize: 9, marginBottom: 6 }}>CONTROLS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 14 }}>
                  {([
                    ['👆 DRAG', 'Pan camera'],
                    ['🤏 PINCH', 'Zoom'],
                    ['🔄 2 FINGERS', 'Rotate camera'],
                    ['TAP', 'Place / select'],
                    ['TAP + DRAG', 'Draw paths'],
                    ['TAP BUILDING', 'Manage it'],
                  ] as [string, string][]).map(([key, desc]) => (
                    <div key={key} style={{ padding: '6px 7px', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-green-hi)' }}>{key}</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'var(--px-text)' }}>{desc}</span>
                    </div>
                  ))}
                </div>

                {/* First steps */}
                <div className="px-label" style={{ fontSize: 9, marginBottom: 6 }}>FIRST STEPS</div>
                <div style={{ display: 'grid', gap: 3, marginBottom: 14 }}>
                  {([
                    ['1', 'Draw PATHS from the entrance gate'],
                    ['2', 'Place a RIDE connected to the path'],
                    ['3', 'Add FOOD, DRINKS & TOILETS nearby'],
                    ['4', 'OPEN the park and watch income grow'],
                  ] as [string, string][]).map(([n, text]) => (
                    <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', background: 'rgba(0,0,0,0.25)' }}>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)', flexShrink: 0, lineHeight: 1.6 }}>{n}</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-text)', lineHeight: 1.7 }}>{text}</span>
                    </div>
                  ))}
                </div>

                {/* Guest needs */}
                <div className="px-label" style={{ fontSize: 9, marginBottom: 6 }}>KEEP GUESTS HAPPY</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 6 }}>
                  {([
                    ['🎢 FUN', 'Rides'],
                    ['🍔 HUNGER', 'Burger stalls'],
                    ['🥤 THIRST', 'Drink stands'],
                    ['🚽 HYGIENE', 'Toilets & bins'],
                  ] as [string, string][]).map(([need, fix]) => (
                    <div key={need} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-green-hi)' }}>{need}</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'var(--px-text)' }}>{fix}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-text)', lineHeight: 1.8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', marginBottom: 6 }}>
                  Unhappy guests leave and your rating drops.
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-text)', lineHeight: 1.8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', marginBottom: 6 }}>
                  <span style={{ color: 'var(--px-green-hi)' }}>PRICIER rides = more FUN</span> per visit. Upgrade attractions to satisfy guests faster.
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-text)', lineHeight: 1.8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', marginBottom: 14 }}>
                  Every building has a <span style={{ color: 'var(--px-green-hi)' }}>maintenance cost per minute</span>. Don't overbuild — check expenses before expanding.
                </div>

                {/* Goal */}
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)', lineHeight: 1.9, padding: '8px 10px', background: 'rgba(255,220,0,0.07)', border: '1px solid rgba(255,220,0,0.2)', marginBottom: 14 }}>
                  GOAL: reach 5 stars ⭐ by keeping guests happy and growing your park.
                </div>

                <button className="px-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 10 }} onClick={() => setShowHelp(false)}>
                  OK, LET'S BUILD
                </button>
              </div>
            </div>
          ) : (
            /* ── DESKTOP HELP ──────────────────────────────────────────── */
            <div className="px-panel px-panel--help px-scroll-hidden" style={{ maxWidth: 640, width: '94%', padding: 0, maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div className="px-titlebar">HOW TO PLAY</div>
              <div style={{ padding: '20px 24px 24px' }}>

                {/* Two-column layout: controls + first steps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                  {/* Controls */}
                  <div>
                    <div className="px-label" style={{ marginBottom: 8 }}>CONTROLS</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      {([
                        ['RMB DRAG', 'Pan camera'],
                        ['SCROLL', 'Zoom'],
                        ['Z / X', 'Rotate camera'],
                        ['LMB', 'Place / select'],
                        ['LMB DRAG', 'Draw paths'],
                        ['R', 'Rotate building'],
                        ['RMB / ESC', 'Cancel placement'],
                      ] as [string, string][]).map(([key, desc]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '5px 7px', background: 'rgba(0,0,0,0.28)' }}>
                          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)', flexShrink: 0 }}>{key}</span>
                          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-text)', textAlign: 'right' }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* First steps */}
                  <div>
                    <div className="px-label" style={{ marginBottom: 8 }}>FIRST STEPS</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      {([
                        ['1', 'Draw PATHS from the entrance gate'],
                        ['2', 'Place a RIDE connected to the path'],
                        ['3', 'Add FOOD, DRINKS & TOILETS nearby'],
                        ['4', 'OPEN the park — watch income grow'],
                        ['5', 'Use RESEARCH to unlock stronger rides'],
                        ['6', 'Complete CHALLENGES for bonus cash'],
                      ] as [string, string][]).map(([n, text]) => (
                        <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 7px', background: 'rgba(0,0,0,0.28)' }}>
                          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-green-hi)', flexShrink: 0 }}>{n}</span>
                          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-text)', lineHeight: 1.65 }}>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="px-divider" />

                {/* Guest needs */}
                <div className="px-label" style={{ marginBottom: 8 }}>KEEP GUESTS HAPPY</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 10 }}>
                  {([
                    ['🎢', 'FUN', 'Build rides'],
                    ['🍔', 'HUNGER', 'Burger stalls'],
                    ['🥤', 'THIRST', 'Drink stands'],
                    ['🚽', 'HYGIENE', 'Toilets & bins'],
                  ] as [string, string, string][]).map(([icon, need, fix]) => (
                    <div key={need} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', textAlign: 'center' }}>
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-green-hi)' }}>{need}</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'var(--px-text)', lineHeight: 1.6 }}>{fix}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-text)', lineHeight: 1.8, padding: '7px 10px', background: 'rgba(0,0,0,0.2)' }}>
                  Guests <span style={{ color: 'var(--px-green-hi)' }}>spend money</span> when their needs are met. If needs stay unmet, guests leave and your <span style={{ color: 'var(--px-green-hi)' }}>rating drops</span>.
                </div>

                <hr className="px-divider" />

                {/* Tips + goal */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div className="px-label" style={{ marginBottom: 8 }}>TIPS</div>
                    <div style={{ display: 'grid', gap: 3 }}>
                      {[
                        'Rides must touch a path — or guests ignore them.',
                        'Pricier rides give MORE FUN per visit — upgrade to satisfy guests faster.',
                        'Every building has a maintenance cost per minute — check expenses before expanding.',
                        'Decorations near rides boost mood & appeal.',
                      ].map(tip => (
                        <div key={tip} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.25)', fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-text)', lineHeight: 1.7 }}>
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-green-hi)', lineHeight: 1.9, padding: '10px 12px', background: 'rgba(255,220,0,0.07)', border: '1px solid rgba(255,220,0,0.2)', flex: 1 }}>
                      GOAL: reach 5 stars ⭐ by keeping guests happy and growing your park.
                    </div>
                    <button className="px-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowHelp(false)}>
                      OK, LET'S BUILD
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
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
