import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '../hooks/useIsMobile';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: (saveData: unknown) => void;
  onError: (message: string) => void;
}

function XLogo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function MainMenu({ onNewGame, onLoadGame, onError }: MainMenuProps) {
  const isMobile = useIsMobile();
  const loadInputRef = useRef<HTMLInputElement>(null);
  const newGameBtnRef = useRef<HTMLButtonElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hovered, setHovered] = useState<'new' | 'load' | null>(null);

  useEffect(() => {
    newGameBtnRef.current?.focus();
  }, []);

  const handleLoadClick = () => {
    setErrorMessage(null);
    loadInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      onLoadGame(parsed);
    } catch {
      const msg = 'This file is not a valid save.';
      setErrorMessage(msg);
      onError(msg);
    }
  };

  const logoSize = isMobile ? 260 : 360;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Theme Park Vibes main menu"
      style={{ position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Background */}
      <img
        src="/ui/menu-background.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          imageRendering: 'pixelated',
          pointerEvents: 'none', userSelect: 'none',
        }}
      />

      {/* Multi-layer overlay for depth */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 70% at 50% 55%, rgba(80,20,140,0.18) 0%, transparent 70%)',
      }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(4,1,12,0.85) 0%, rgba(4,1,12,0.30) 30%, rgba(4,1,12,0.38) 60%, rgba(2,0,10,0.95) 100%)',
      }} />

      {/* Bats */}
      <div className="px-menu-bats" aria-hidden="true">
        <span className="px-menu-bat px-menu-bat--one" />
        <span className="px-menu-bat px-menu-bat--two" />
        <span className="px-menu-bat px-menu-bat--three" />
        <span className="px-menu-bat px-menu-bat--four" />
        <span className="px-menu-bat px-menu-bat--five" />
        <span className="px-menu-bat px-menu-bat--six" />
        <span className="px-menu-bat px-menu-bat--seven" />
      </div>

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: '100%',
        padding: isMobile ? '0 20px' : '0 32px',
      }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.05 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <img
            src="/models/logo.png"
            alt="Theme Park Vibes"
            width={logoSize}
            height={logoSize}
            style={{
              width: logoSize, height: logoSize,
              imageRendering: 'pixelated',
              filter: isMobile
                ? 'drop-shadow(0 0 16px rgba(251,113,133,0.8)) drop-shadow(0 0 32px rgba(168,85,247,0.55)) drop-shadow(0 6px 10px rgba(0,0,0,0.95))'
                : 'drop-shadow(0 0 32px rgba(251,113,133,1)) drop-shadow(0 0 64px rgba(168,85,247,0.8)) drop-shadow(0 10px 16px rgba(0,0,0,1))',
            }}
            draggable={false}
          />

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{
              marginTop: isMobile ? -12 : -16,
              marginBottom: isMobile ? 28 : 36,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            <p style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: isMobile ? 8 : 10,
              color: '#e9d5ff',
              margin: 0,
              letterSpacing: 3,
              padding: '6px 16px',
              background: 'linear-gradient(90deg, rgba(4,1,14,0), rgba(4,1,14,0.75) 20%, rgba(4,1,14,0.75) 80%, rgba(4,1,14,0))',
              textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 0 0 18px rgba(168,85,247,0.95)',
            }}>
              BUILD YOUR HAUNTED PARK
            </p>
            {/* Decorative divider */}
            <div style={{
              width: isMobile ? 180 : 240, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(196,181,253,0.4), rgba(251,113,133,0.3), rgba(196,181,253,0.4), transparent)',
            }} />
          </motion.div>
        </motion.div>

        {/* Buttons */}
        <div style={{ width: '100%', maxWidth: isMobile ? 300 : 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* NEW GAME */}
          <motion.button
            ref={newGameBtnRef}
            className="px-btn px-menu-action px-menu-action--primary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.38 }}
            style={{
              opacity: hovered === 'load' ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
              animation: 'px-menu-pulse 2.2s ease-in-out infinite',
            }}
            onClick={onNewGame}
            onMouseEnter={() => setHovered('new')}
            onMouseLeave={() => setHovered(null)}
            aria-label="Start a new game"
          >
            <Play />
            <span>NEW GAME</span>
          </motion.button>

          {/* LOAD GAME */}
          <motion.button
            className="px-btn px-menu-action px-menu-action--secondary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.50 }}
            style={{
              opacity: hovered === 'new' ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
            onClick={handleLoadClick}
            onMouseEnter={() => setHovered('load')}
            onMouseLeave={() => setHovered(null)}
            aria-label="Load a saved game"
          >
            <FolderOpen />
            <span>LOAD GAME</span>
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {errorMessage && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  fontFamily: "'Press Start 2P', monospace", fontSize: 9,
                  color: '#f87171', margin: '2px 0 0', textAlign: 'center',
                  textShadow: '1px 1px 0 #000',
                }}
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        style={{
          position: 'absolute',
          bottom: isMobile ? 'calc(16px + var(--safe-bottom, 0px))' : 20,
          left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, zIndex: 1,
        }}
      >
        {/* Decorative line left */}
        <div style={{ flex: 1, maxWidth: 60, height: 1, background: 'linear-gradient(90deg, transparent, rgba(180,160,220,0.25))' }} />

        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'rgba(180,160,220,0.45)', letterSpacing: 1 }}>v1.0.0</span>
        <span style={{ color: 'rgba(180,160,220,0.25)', fontSize: 10 }}>·</span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'rgba(180,160,220,0.45)', letterSpacing: 1 }}>by Seba Lopez</span>
        <span style={{ color: 'rgba(180,160,220,0.25)', fontSize: 10 }}>·</span>
        <a
          href="https://x.com/Sebalg_tech"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(180,160,220,0.55)', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(220,200,255,0.95)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,160,220,0.55)')}
          aria-label="Follow on X"
        >
          <XLogo size={isMobile ? 20 : 24} />
        </a>

        {/* Decorative line right */}
        <div style={{ flex: 1, maxWidth: 60, height: 1, background: 'linear-gradient(90deg, rgba(180,160,220,0.25), transparent)' }} />
      </motion.div>

      <input
        ref={loadInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
