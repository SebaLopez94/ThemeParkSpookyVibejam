import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Play } from 'lucide-react';
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
  const [hoveredBtn, setHoveredBtn] = useState<'new' | 'load' | null>(null);

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

  const logoSize = isMobile ? 270 : 370;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Theme Park Vibes main menu"
      style={{ position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Background image */}
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

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(4,1,12,0.78) 0%, rgba(4,1,12,0.42) 35%, rgba(4,1,12,0.48) 65%, rgba(4,1,12,0.85) 100%)',
      }} />

      {/* Main content — logo + buttons */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: isMobile ? 4 : 6,
        padding: isMobile ? '0 24px' : '0 32px',
        width: '100%',
      }}>

        {/* Logo */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          animation: 'px-menu-logo-enter 0.6s cubic-bezier(0.34,1.2,0.64,1) both',
        }}>
          <img
            src="/models/logo.png"
            alt="Theme Park Vibes"
            width={logoSize}
            height={logoSize}
            style={{
              width: logoSize, height: logoSize,
              imageRendering: 'pixelated',
              filter: isMobile
                ? 'drop-shadow(0 0 12px rgba(251,113,133,0.75)) drop-shadow(0 0 24px rgba(168,85,247,0.50)) drop-shadow(0 5px 8px rgba(0,0,0,0.9))'
                : 'drop-shadow(0 0 28px rgba(251,113,133,0.95)) drop-shadow(0 0 56px rgba(168,85,247,0.75)) drop-shadow(0 8px 12px rgba(0,0,0,1))',
            }}
            draggable={false}
          />
          {/* Subtitle with dark band for legibility */}
          <p style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: isMobile ? 8 : 9,
            color: '#e9d5ff',
            margin: 0,
            marginBottom: isMobile ? 12 : 16,
            letterSpacing: 2,
            padding: '5px 12px',
            background: 'rgba(4,1,14,0.62)',
            textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 0 0 14px rgba(168,85,247,0.9)',
          }}>
            BUILD YOUR HAUNTED PARK
          </p>
        </div>

        {/* Buttons */}
        <div style={{
          width: '100%', maxWidth: isMobile ? 300 : 340,
          display: 'flex', flexDirection: 'column',
          gap: isMobile ? 14 : 16,
        }}>
          {/* NEW GAME — primary CTA */}
          <button
            ref={newGameBtnRef}
            className="px-btn px-btn--lg"
            style={{
              width: '100%', justifyContent: 'center',
              fontSize: isMobile ? 13 : 15,
              padding: isMobile ? '16px 20px' : '18px 24px',
              borderTopColor: '#d4c0ec', borderLeftColor: '#c4aee0',
              animation: 'px-menu-pulse 2.2s ease-in-out infinite, px-menu-btn-enter 0.45s 0.25s cubic-bezier(0.34,1.2,0.64,1) both',
              opacity: hoveredBtn === 'load' ? 0.55 : 1,
              transition: 'opacity 0.18s ease',
            }}
            onClick={onNewGame}
            onMouseEnter={() => setHoveredBtn('new')}
            onMouseLeave={() => setHoveredBtn(null)}
            aria-label="Start a new game"
          >
            <Play />
            NEW GAME
          </button>

          {/* LOAD GAME */}
          <button
            className="px-btn px-btn--lg"
            style={{
              width: '100%', justifyContent: 'center',
              fontSize: isMobile ? 13 : 14,
              animation: 'px-menu-btn-enter 0.45s 0.38s cubic-bezier(0.34,1.2,0.64,1) both',
              opacity: hoveredBtn === 'new' ? 0.55 : 1,
              transition: 'opacity 0.18s ease',
            }}
            onClick={handleLoadClick}
            onMouseEnter={() => setHoveredBtn('load')}
            onMouseLeave={() => setHoveredBtn(null)}
            aria-label="Load a saved game"
          >
            <FolderOpen />
            LOAD GAME
          </button>

          {errorMessage && (
            <p role="alert" style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 9,
              color: '#f87171', margin: '2px 0 0', textAlign: 'center',
              textShadow: '1px 1px 0 #000',
            }}>
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Footer — fixed to bottom */}
      <div style={{
        position: 'absolute', bottom: isMobile ? 16 : 20, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, zIndex: 1,
        animation: 'px-menu-footer-enter 0.6s 0.55s ease both',
      }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'rgba(180,160,220,0.55)', letterSpacing: 1 }}>v1.0.0</span>
        <span style={{ color: 'rgba(180,160,220,0.3)', fontSize: 10 }}>·</span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 7 : 8, color: 'rgba(180,160,220,0.55)', letterSpacing: 1 }}>by Seba Lopez</span>
        <span style={{ color: 'rgba(180,160,220,0.3)', fontSize: 10 }}>·</span>
        <a
          href="https://x.com/Sebalg_tech"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(180,160,220,0.6)', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(220,200,255,0.9)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,160,220,0.6)')}
          aria-label="Follow on X"
        >
          <XLogo size={isMobile ? 22 : 26} />
        </a>
      </div>

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
