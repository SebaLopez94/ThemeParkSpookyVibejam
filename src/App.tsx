import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useIsMobile } from './hooks/useIsMobile';
import {
  FlaskConical,
  Gem,
  Hammer,
  HelpCircle,
  MessageSquare,
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
import { ThoughtsPanel } from './ui/ThoughtsPanel';
import { BuildingIcon } from './ui/BuildingIcon';
import { BuildingTooltip } from './ui/BuildingTooltip';
import { MainMenu } from './ui/MainMenu';
import { ToastItem, ToastStack } from './ui/ToastStack';
import { GuideCharacter, GuideLine } from './ui/GuideCharacter';
import {
  BuildingType,
  ChallengeState,
  EconomyState,
  BuildingDefinition,
  GridPosition,
  ResearchNode,
  ResearchState,
  SelectedBuildingInfo,
  FeedMessage,
  VisitorMoodKind,
} from './types';

// ── Feed grouping helpers ────────────────────────────────────────────────────
const GROUP_LABELS: Partial<Record<VisitorMoodKind, (n: number) => string>> = {
  hunger:   n => `${n} guests are starving`,
  thirst:   n => `${n} guests need a drink`,
  bored:    n => `${n} guests are bored`,
  sick:     n => `${n} guests feel sick`,
  sad:      n => `${n} guests are unhappy`,
  crowded:  n => `${n} guests feel crowded`,
  price:    n => `${n} guests think prices are too high`,
  broke:    n => `${n} guests ran out of money`,
  happy:    n => `${n} guests are loving it`,
  excited:  n => `${n} guests are having a blast`,
  shopping: n => `${n} guests made purchases`,
};
function getGroupedText(kind: VisitorMoodKind, count: number): string {
  return GROUP_LABELS[kind]?.(count) ?? `${count} similar thoughts`;
}
function mergeFeed(msg: FeedMessage, prev: FeedMessage[]): FeedMessage[] {
  const last = prev[0];
  const GROUP_WINDOW_MS = 5000;
  if (
    last &&
    last.kind === msg.kind &&
    msg.kind !== 'park_event' &&
    Date.now() - last.timestamp < GROUP_WINDOW_MS &&
    (last.count ?? 1) < 6
  ) {
    const count = (last.count ?? 1) + 1;
    return [{ ...last, count, text: getGroupedText(last.kind as VisitorMoodKind, count) }, ...prev.slice(1)];
  }
  return [msg, ...prev].slice(0, 8);
}

const RANDOM_GATE_KEEPER_LINES: GuideLine[] = [
  {
    tag: 'Gate Keeper',
    title: 'Rate Limit Horror',
    text: 'This park is scarier than a Claude rate limit, and somehow less predictable.'
  },
  {
    tag: 'Gate Keeper',
    title: 'Fog Inspection',
    text: 'Excellent fog density today. It hides bad decisions and makes cheap paths look mysterious.'
  },
  {
    tag: 'Gate Keeper',
    title: 'Keeper Wisdom',
    text: 'Screams mean profit. Silence means trouble. Complaints mean the Feed is doing unpaid QA.'
  },
  {
    tag: 'Gate Keeper',
    title: 'Guest Lore',
    text: 'A happy guest brings friends. An angry guest brings reviews, refunds, and dramatic footsteps.'
  }
];

const CLAUDE_RATE_LIMIT_LINE: GuideLine = {
  tag: 'Gate Keeper',
  title: 'Rate Limit Horror',
  text: 'This park is scarier than a Claude rate limit, and somehow less predictable.'
};

function pickRandomGateKeeperJoke(): GuideLine {
  const pool = RANDOM_GATE_KEEPER_LINES.filter(line => line.text !== CLAUDE_RATE_LIMIT_LINE.text);
  return pool[Math.floor(Math.random() * pool.length)] ?? CLAUDE_RATE_LIMIT_LINE;
}

function pickGateKeeperLine(economy: EconomyState, latestThought?: FeedMessage): GuideLine {
  if (Math.random() < 0.35) return pickRandomGateKeeperJoke();

  if (economy.averageHappiness < 38) {
    return {
      tag: 'Gate Keeper',
      title: 'Joy Is Fading',
      text: 'The crowd mood is sinking. Lower the greed, raise the fun, and inspect the Feed before the whispers become refunds.'
    };
  }

  if (latestThought) {
    const thoughtLines: Partial<Record<VisitorMoodKind, GuideLine>> = {
      hunger: {
        tag: 'Gate Keeper',
        title: 'Hungry Shadows',
        text: 'Guests are hungry. A haunted Burger stand may prevent a very unprofitable uprising.'
      },
      thirst: {
        tag: 'Gate Keeper',
        title: 'Dry Screams',
        text: 'Thirsty guests scream less impressively. Add Drink support before the atmosphere gets crunchy.'
      },
      bored: {
        tag: 'Gate Keeper',
        title: 'Boredom Curse',
        text: 'Some guests are bored. New rides, Lab unlocks, or darker decorations should wake them up.'
      },
      sick: {
        tag: 'Gate Keeper',
        title: 'Hygiene Omen',
        text: 'The air feels cursed. Add WC access and trash support before the park develops its own smell.'
      },
      price: {
        tag: 'Gate Keeper',
        title: 'Wallet Panic',
        text: 'Prices are frightening guests in the wrong direction. Fear works best when wallets survive the entrance.'
      },
      happy: {
        tag: 'Gate Keeper',
        title: 'Good Screams',
        text: 'Guests are enjoying themselves. Disturbing, yes. Profitable, also yes. Keep feeding that momentum.'
      },
      excited: {
        tag: 'Gate Keeper',
        title: 'Crowd Energy',
        text: 'The crowd is buzzing. Expand while they still believe this place is under control.'
      }
    };

    const line = latestThought.kind === 'park_event' ? undefined : thoughtLines[latestThought.kind];
    if (line) return line;
  }

  return pickRandomGateKeeperJoke();
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const economyRef = useRef<EconomyState | null>(null);
  const thoughtsFeedRef = useRef<FeedMessage[]>([]);
  const guideBlockedRef = useRef(false);
  const firstAmbientGuideRef = useRef(true);
  const ambientGuideTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
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
  // menu immediately â€" the ResearchSystem fires its first notify() before
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
  const [showThoughtsPanel, setShowThoughtsPanel] = useState(false);
  const [thoughtsFeed, setThoughtsFeed] = useState<FeedMessage[]>([]);
  const [mobilePanelDragY, setMobilePanelDragY] = useState(0);
  const [isMobilePanelDragging, setIsMobilePanelDragging] = useState(false);
  const [isMobilePanelClosing, setIsMobilePanelClosing] = useState(false);
  const [activeBuildDefinition, setActiveBuildDefinition] = useState<BuildingDefinition | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [celebration, setCelebration] = useState<{ title: string; sub: string; reward: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [menuTransitioning, setMenuTransitioning] = useState(false);
  const [openingIntroActive, setOpeningIntroActive] = useState(false);
  const [openingIntroLoading, setOpeningIntroLoading] = useState(false);
  const shouldPlayOpeningIntroRef = useRef(false);
  const menuTransitionTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guideLines, setGuideLines] = useState<GuideLine[] | undefined>(undefined);
  const [pendingSaveData, setPendingSaveData] = useState<unknown | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<SelectedBuildingInfo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const pushToast = (tone: ToastItem['tone'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(current => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 2600);
  };

  useEffect(() => {
    economyRef.current = economy;
  }, [economy]);

  useEffect(() => {
    thoughtsFeedRef.current = thoughtsFeed;
  }, [thoughtsFeed]);

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
      setHoveredBuilding(null);
    });
    events.on('buildingPlaced', (placedType) => {
      if (placedType === BuildingType.DECORATION) return;
      game.cancelBuildMode();
      setSelectedBuilding(null);
      setShowBuildMenu(false);
      setIsPlacing(false);
      setActiveBuildDefinition(null);
    });
    events.on('rotationChange', degree => setBuildRotation(degree));
    events.on('researchUpdate', state => setResearchState(state));
    events.on('challengesUpdate', state => setChallenges(state));
    events.on('newThought', msg => setThoughtsFeed(prev => mergeFeed(msg, prev)));
    events.on('buildingHovered', info => setHoveredBuilding(info));

    const onMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    if (!isMobile) window.addEventListener('mousemove', onMouseMove);
    events.on('challengeCompleted', challenge => {
      const celebrationIds: Record<string, { title: string; sub: string }> = {
        challenge_first_ride:   { title: 'ðŸŽ¡ FIRST RIDE OPEN!',      sub: 'The crowds are flooding in!' },
        challenge_three_rides:  { title: 'ðŸŽ¢ THRILL PARK UNLOCKED!',  sub: 'Three rides â€" fear is your product.' },
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

    const shouldPlayOpeningIntro = shouldPlayOpeningIntroRef.current && pendingSaveData === null;
    shouldPlayOpeningIntroRef.current = false;
    if (shouldPlayOpeningIntro) {
      setOpeningIntroActive(true);
      setOpeningIntroLoading(true);
      Promise.race([
        game.waitForOpeningVisuals(),
        new Promise<void>(resolve => window.setTimeout(resolve, 500)),
      ]).then(() => {
        if (gameRef.current !== game) return;
        setOpeningIntroLoading(false);
        window.setTimeout(() => {
          if (gameRef.current === game) setMenuTransitioning(false);
        }, 260);
        game.playOpeningIntro(() => {
          setOpeningIntroActive(false);
          setOpeningIntroLoading(false);
          setMenuTransitioning(false);
          setGuideLines(undefined);
          setShowGuide(true);
        });
      });
    } else {
      setMenuTransitioning(false);
    }

    return () => {
      if (!isMobile) window.removeEventListener('mousemove', onMouseMove);
      setOpeningIntroActive(false);
      setOpeningIntroLoading(false);
      setMenuTransitioning(false);
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
      if (menuTransitionTimerRef.current) window.clearTimeout(menuTransitionTimerRef.current);
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
  const shouldShowHud = !openingIntroActive && !(isMobile && isBuildMenuVisible);
  const guideUiBlocked = openingIntroActive || showBuildMenu || Boolean(selectedBuilding) || isPlacing || showParkPanel || showChallenges || showResearch || showThoughtsPanel;
  useEffect(() => {
    guideBlockedRef.current = guideUiBlocked || showGuide;
  }, [guideUiBlocked, showGuide]);

  useEffect(() => {
    if (!gameStarted) return;
    const scheduleAmbientGuide = (delay: number) => {
      ambientGuideTimerRef.current = window.setTimeout(() => {
        ambientGuideTimerRef.current = null;
        if (guideBlockedRef.current) {
          scheduleAmbientGuide(45000);
          return;
        }

        const state = economyRef.current;
        if (!state || state.totalVisitors < 3) {
          scheduleAmbientGuide(45000);
          return;
        }

        const nextLine = firstAmbientGuideRef.current
          ? CLAUDE_RATE_LIMIT_LINE
          : pickGateKeeperLine(state, thoughtsFeedRef.current[0]);
        firstAmbientGuideRef.current = false;
        setGuideLines([nextLine]);
        setShowGuide(true);
        scheduleAmbientGuide(45000);
      }, delay);
    };

    scheduleAmbientGuide(firstAmbientGuideRef.current ? 30000 : 45000);

    return () => {
      if (ambientGuideTimerRef.current) window.clearTimeout(ambientGuideTimerRef.current);
      ambientGuideTimerRef.current = null;
    };
  }, [gameStarted]);

  const activeResearchLabel = useMemo(
    () => researchNodes.find(node => node.id === researchState.activeResearchId)?.name ?? 'Idle',
    [researchNodes, researchState.activeResearchId]
  );
  const celebrationTitle = celebration?.title.replace(/^[^A-Za-z0-9]+/u, '').trim() ?? '';

  const controlsRight = 16;
  const activeMobilePanel = showParkPanel ? 'park' : showChallenges ? 'challenges' : showResearch ? 'research' : showThoughtsPanel ? 'thoughts' : null;
  const activeMobileSheet = isBuildMenuVisible ? 'build' : activeMobilePanel;
  const mobileFullscreenPanelStyle = {
    height: 'calc(100dvh - 56px - var(--safe-bottom))',
    maxHeight: 'calc(100dvh - 56px - var(--safe-bottom))',
    borderRadius: 0,
  };
  const resetMobilePanelMotion = () => {
    setMobilePanelDragY(0);
    setIsMobilePanelDragging(false);
  };
  const clearMobileOverlayPanels = () => {
    setShowParkPanel(false);
    setShowChallenges(false);
    setShowResearch(false);
    setShowThoughtsPanel(false);
  };
  const getMobileSheetCloseDistance = () => {
    if (activeMobileSheet === 'build') {
      return mobileSheetRef.current?.getBoundingClientRect().height ?? window.innerHeight;
    }
    return window.innerHeight;
  };
  const closeMobileOverlayPanels = () => {
    if (!activeMobileSheet) return;
    if (activeMobileSheet === 'build') {
      handleCancelBuildMode();
    } else {
      clearMobileOverlayPanels();
    }
    setMobilePanelDragY(0);
    setIsMobilePanelDragging(false);
  };
  const openMobilePanel = (panel: 'park' | 'challenges' | 'research' | 'thoughts') => {
    if (activeMobilePanel === panel) {
      closeMobileOverlayPanels();
      return;
    }
    resetMobilePanelMotion();
    setShowParkPanel(panel === 'park');
    setShowChallenges(panel === 'challenges');
    setShowResearch(panel === 'research');
    setShowThoughtsPanel(panel === 'thoughts');
    setShowBuildMenu(false);
  };
  const mobileSheetTouchHandlers = {
    drag: "y" as const,
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.8 },
    onDragEnd: (_e: any, info: any) => {
      if (info.offset.y > 100 || info.velocity.y > 500) {
        closeMobileOverlayPanels();
      }
    }
  };
  const mobileSheetClassName = `px-mobile-panel-sheet${activeMobileSheet === 'build' ? ' px-mobile-panel-sheet--build' : ''}`;
  const mobileSheetDragStyle = {};
  const guideVisible = showGuide && !openingIntroActive && !showBuildMenu && !selectedBuilding && !isPlacing && !showParkPanel && !showChallenges && !showResearch && !showThoughtsPanel;
  const finishMenuTransition = () => {
    if (menuTransitionTimerRef.current) window.clearTimeout(menuTransitionTimerRef.current);
    menuTransitionTimerRef.current = window.setTimeout(() => {
      menuTransitionTimerRef.current = null;
      setGameStarted(true);
    }, 650);
  };

  if (!gameStarted) {
    return (
      <>
        <MainMenu
          onNewGame={() => {
            if (menuTransitioning) return;
            setMenuTransitioning(true);
            setPendingSaveData(null);
            shouldPlayOpeningIntroRef.current = true;
            firstAmbientGuideRef.current = true;
            setGuideLines(undefined);
            setShowGuide(false);
            setOpeningIntroActive(true);
            setOpeningIntroLoading(true);
            finishMenuTransition();
          }}
          onLoadGame={saveData => {
            if (menuTransitioning) return;
            setMenuTransitioning(true);
            setPendingSaveData(saveData);
            shouldPlayOpeningIntroRef.current = false;
            firstAmbientGuideRef.current = true;
            setGuideLines(undefined);
            setShowGuide(true);
            finishMenuTransition();
          }}
          onError={msg => pushToast('warning', msg)}
        />
        <AnimatePresence>
          {menuTransitioning && (
            <motion.div
              className="px-main-menu-fade"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.62, ease: 'easeInOut' }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className={`relative w-screen h-screen overflow-hidden${openingIntroActive ? ' px-game--intro' : ''}`}>
      <div ref={containerRef} className="w-full h-full" />
      <input
        ref={loadInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleLoadFile}
      />
      <ToastStack items={toasts} />

      <AnimatePresence>
        {openingIntroActive && (
          <motion.div
            className={`px-opening-intro${openingIntroLoading ? ' px-opening-intro--loading' : ''}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.55 } }}
            aria-hidden="true"
          >
            {!openingIntroLoading && (
              <>
                <motion.div
                  className="px-opening-intro__reveal"
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.28 }}
                  transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.div
                  className="px-opening-intro__caption"
                  initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.65, duration: 0.85, ease: 'easeOut' }}
                >
                  <span className="px-opening-intro__kicker">THE GATE KEEPER IS WAITING FOR YOU</span>
                  <span className="px-opening-intro__title">THEME PARK SPOOKY IS OPENING</span>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {shouldShowHud && <HUD economy={economy} hideMoney={showParkPanel} lockCollapsed={isMobile && guideVisible} />}

      <AnimatePresence>
        {guideVisible && (
          <GuideCharacter
            lines={guideLines}
            autoCloseMs={guideLines ? 4000 : undefined}
            isMuted={isMuted}
            onClose={() => {
              setShowGuide(false);
              setGuideLines(undefined);
            }}
          />
        )}
      </AnimatePresence>

      {/* â"€â"€ Desktop side tabs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {/* ── Desktop icon dock ──────────────────────────────────────────── */}
      {!openingIntroActive && <div className="px-icon-dock">
        <button
          className={`px-dock-btn px-dock-btn--park${showParkPanel ? ' px-dock-btn--active' : ''}`}
          title="Manage Park"
          aria-label="Manage Park"
          onClick={() => { setShowParkPanel(v => !v); setShowChallenges(false); setShowResearch(false); }}
        >
          <RollerCoaster size={24} />
          <span className="px-dock-btn__label">PARK</span>
        </button>
        <button
          className={`px-dock-btn px-dock-btn--challenges${showChallenges ? ' px-dock-btn--active' : ''}`}
          title="Challenges"
          aria-label="Challenges"
          style={{ position: 'relative' }}
          onClick={() => { setShowChallenges(v => !v); setShowParkPanel(false); setShowResearch(false); }}
        >
          <Trophy size={24} />
          <span className="px-dock-btn__label">GOALS</span>
          {challenges.some(c => c.completed && !c.claimed) && (
            <span className="px-notif-dot" aria-hidden="true" />
          )}
        </button>
        <button
          className={`px-dock-btn px-dock-btn--research${showResearch ? ' px-dock-btn--active' : ''}`}
          title="Lab"
          aria-label="Lab"
          onClick={() => { setShowResearch(v => !v); setShowParkPanel(false); setShowChallenges(false); setShowThoughtsPanel(false); }}
        >
          <FlaskConical size={24} />
          <span className="px-dock-btn__label">LAB</span>
        </button>
        <button
          className={`px-dock-btn px-dock-btn--thoughts${showThoughtsPanel ? ' px-dock-btn--active' : ''}`}
          title="Thoughts Feed"
          aria-label="Thoughts Feed"
          onClick={() => { setShowThoughtsPanel(v => !v); setShowParkPanel(false); setShowChallenges(false); setShowResearch(false); }}
        >
          <MessageSquare size={24} />
          <span className="px-dock-btn__label">FEED</span>
        </button>
      </div>}

      {/* ── Desktop panels ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showParkPanel && (
          <motion.div
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="px-dock-panel px-dock-panel--park"
          >
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
          </motion.div>
        )}
        {showChallenges && (
          <motion.div
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="px-dock-panel px-dock-panel--challenges"
          >
            <ChallengesPanel challenges={challenges} onClose={() => setShowChallenges(false)} />
          </motion.div>
        )}
        {showResearch && (
          <motion.div
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="px-dock-panel px-dock-panel--research"
          >
            <ResearchPanel
              nodes={researchNodes}
              state={researchState}
              onStartResearch={id => gameRef.current?.startResearch(id)}
              canAffordResearch={cost => canAfford(cost)}
              onClose={() => setShowResearch(false)}
            />
          </motion.div>
        )}
        {showThoughtsPanel && (
          <motion.div
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="px-dock-panel px-dock-panel--thoughts"
          >
            <ThoughtsPanel
              feed={thoughtsFeed}
              onClose={() => setShowThoughtsPanel(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* â"€â"€ Mobile bottom nav â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {!openingIntroActive && isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 95 }}>
          {/* Active panel — fullscreen on mobile */}
          <AnimatePresence>
            {(showParkPanel || showChallenges || showResearch || showThoughtsPanel) && (
              <motion.div
                ref={mobileSheetRef}
                className={mobileSheetClassName}
                initial={{ y: "100%", opacity: 0.98 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0.98, transition: { type: "tween", duration: 0.25, ease: "easeInOut" } }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
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
                {showThoughtsPanel && (
                  <ThoughtsPanel
                    style={mobileFullscreenPanelStyle}
                    feed={thoughtsFeed}
                    onClose={closeMobileOverlayPanels}
                  />
                )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
              LAB
            </button>
            <button
              className={`px-btn px-mobile-tab px-side-tab--thoughts${showThoughtsPanel ? ' px-btn--active' : ''}`}
              onClick={() => openMobilePanel('thoughts')}
            >
              <MessageSquare size={16} />
              FEED
            </button>
          </div>
        </div>
      )}

      {!openingIntroActive && !(isMobile && (showParkPanel || showChallenges || showResearch || showThoughtsPanel || showBuildMenu || isPlacing)) && (
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
                    setShowThoughtsPanel(false);
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

      <AnimatePresence>
        {!openingIntroActive && isBuildMenuVisible && (
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
      </AnimatePresence>

      <AnimatePresence>
        {!openingIntroActive && selectedBuilding && (
          <BuildingPanel
            building={selectedBuilding}
            onClose={handleClosePanel}
            onDelete={handleDeleteBuilding}
            onMove={handleMoveBuilding}
            onPriceChange={handlePriceChange}
          />
        )}
      </AnimatePresence>

      {!openingIntroActive && isPlacing && activeBuildDefinition && (
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
                      <div className="px-chip"><RotateCw size={12} />{' R to rotate — '}{buildRotation}{'°'}</div>
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

      {!openingIntroActive && showHelp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowHelp(false)}
        >
          {isMobile ? (
            /* ── MOBILE HELP ───────────────────────────────────────────── */
            <div className="px-panel px-panel--help px-scroll-hidden" style={{ width: '100%', padding: 0, maxHeight: '100dvh', overflowY: 'auto', overflowX: 'hidden', borderRadius: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="px-titlebar" style={{ fontSize: 10, flexShrink: 0 }}>HOW TO PLAY</div>
              <div style={{ padding: '14px 14px 0', overflowY: 'auto', flex: 1 }}>

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

              </div>

              {/* Sticky close button */}
              <div style={{ padding: '10px 14px', paddingBottom: 'calc(10px + var(--safe-bottom, 0px))', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(4,1,12,0.95)' }}>
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
                        ['5', 'Use the LAB to unlock stronger rides'],
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

      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100,
              background: 'radial-gradient(ellipse at 50% 60%, rgba(139,92,246,0.12) 0%, rgba(4,1,12,0.72) 70%)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={() => setCelebration(null)}
          >
            <motion.div
              initial={{ scale: 0.5, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="px-celebration"
              role="alertdialog"
              aria-label="Challenge complete"
              style={{ cursor: 'pointer' }}
            >
              {/* Top glow bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, var(--px-gold), var(--px-purple), var(--px-gold), transparent)', borderRadius: '12px 12px 0 0' }} />

              {/* Image */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <motion.img
                  src="/ui/AMAZING.webp"
                  alt="Amazing!"
                  initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}
                  style={{ width: 72, height: 'auto', imageRendering: 'pixelated', filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.7)) drop-shadow(0 0 24px rgba(168,85,247,0.4))' }}
                />
              </div>

              {/* CHALLENGE COMPLETE label */}
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#d8b4fe', letterSpacing: 2, marginBottom: 10, opacity: 0.85 }}>CHALLENGE COMPLETE</div>

              {/* Title */}
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(13px, 3.5vw, 20px)', color: 'var(--px-gold)', textShadow: '0 0 20px rgba(251,191,36,0.6), 2px 2px 0 #000', lineHeight: 1.5 }}>
                {celebrationTitle}
              </div>

              {/* Divider */}
              <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)', margin: '14px 0' }} />

              {/* Sub text */}
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(8px, 1.8vw, 10px)', color: 'rgba(209,250,229,0.75)', lineHeight: 1.9 }}>
                {celebration.sub}
              </div>

              {/* Reward badge */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 320, damping: 20 }}
                style={{
                  marginTop: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.06) 100%)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  borderRadius: 8,
                  padding: '10px 20px',
                  boxShadow: '0 0 20px rgba(251,191,36,0.15)',
                }}
              >
                <span style={{ fontSize: 16 }}>💰</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(14px, 3.5vw, 22px)', color: 'var(--px-gold)', textShadow: '0 0 12px rgba(251,191,36,0.8)' }}>
                  +${celebration.reward.toLocaleString()}
                </span>
              </motion.div>

              {/* Dismiss hint */}
              <div style={{ marginTop: 18, fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'rgba(255,255,255,0.22)', letterSpacing: 1 }}>TAP TO CONTINUE</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!openingIntroActive && !isMobile && (
        <BuildingTooltip
          info={hoveredBuilding}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
        />
      )}
    </div>
  );
}

export default App;
