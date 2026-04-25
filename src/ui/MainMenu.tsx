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

      {/* Overlay — darkens edges, keeps center visible */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(4,1,12,0.78) 0%, rgba(4,1,12,0.42) 35%, rgba(4,1,12,0.48) 65%, rgba(4,1,12,0.85) 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: isMobile ? 4 : 6,
        padding: isMobile ? '0 24px' : '0 32px',
        width: '100%',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img
            src="/models/logo.png"
            alt="Theme Park Vibes"
            width={logoSize}
            height={logoSize}
            style={{
              width: logoSize, height: logoSize,
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 0 28px rgba(251,113,133,0.95)) drop-shadow(0 0 56px rgba(168,85,247,0.75)) drop-shadow(0 8px 12px rgba(0,0,0,1))',
            }}
            draggable={false}
          />
          <p style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: isMobile ? 8 : 9,
            color: '#e9d5ff',
            margin: 0, marginBottom: isMobile ? 12 : 16, letterSpacing: 2,
            textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 0 0 12px rgba(168,85,247,0.8)',
          }}>
            BUILD YOUR HAUNTED PARK
          </p>
        </div>

        {/* Buttons */}
        <div style={{
          width: '100%', maxWidth: isMobile ? 300 : 320,
          display: 'flex', flexDirection: 'column',
          gap: isMobile ? 14 : 16,
        }}>
          <button
            ref={newGameBtnRef}
            className="px-btn px-btn--lg"
            style={{
              width: '100%', justifyContent: 'center', fontSize: isMobile ? 13 : 14,
              borderTopColor: '#d4c0ec', borderLeftColor: '#c4aee0',
              animation: 'px-menu-pulse 2.2s ease-in-out infinite',
            }}
            onClick={onNewGame}
            aria-label="Start a new game"
          >
            <Play />
            NEW GAME
          </button>

          <button
            className="px-btn px-btn--lg"
            style={{ width: '100%', justifyContent: 'center', fontSize: isMobile ? 13 : 14 }}
            onClick={handleLoadClick}
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

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: isMobile ? 7 : 8,
          color: 'rgba(180,160,220,0.65)',
          letterSpacing: 1,
        }}>
          <span>v1.0.0</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>by Seba Lopez</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <a
            href="https://x.com/Sebalg_tech"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(180,160,220,0.7)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            aria-label="Follow on X"
          >
            <XLogo size={isMobile ? 22 : 26} />
          </a>
        </div>
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
