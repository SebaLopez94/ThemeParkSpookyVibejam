import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FolderOpen, Play } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: (saveData: unknown) => void;
  onError: (message: string) => void;
}

function XLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
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

  const logoSize = isMobile ? 220 : 340;
  const subtitleSize = isMobile ? 10 : 12;
  const cardMaxWidth = isMobile ? 420 : 980;
  const cardPadding = isMobile ? '20px 16px 18px' : '24px 24px 22px';
  const buttonMinHeight = isMobile ? 52 : 58;
  const buttonGap = isMobile ? 10 : 12;

  const rootStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: [
      'radial-gradient(ellipse 80% 60% at 50% 30%, #3a1060 0%, transparent 70%)',
      'radial-gradient(ellipse 60% 40% at 20% 80%, #1a0830 0%, transparent 60%)',
      'radial-gradient(ellipse 60% 40% at 80% 80%, #1a0830 0%, transparent 60%)',
      'linear-gradient(180deg, #0a0710 0%, #130920 40%, #0d0618 100%)',
    ].join(', '),
    padding: 16,
  };

  const starsStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: [
      'radial-gradient(1px 1px at 15% 12%, rgba(255,255,255,0.7) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 32% 7%, rgba(255,255,255,0.5) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 55% 18%, rgba(255,255,255,0.6) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 70% 9%, rgba(255,255,255,0.4) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 85% 22%, rgba(255,255,255,0.7) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 8% 35%, rgba(255,255,255,0.3) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 42% 28%, rgba(255,255,255,0.5) 0%, transparent 100%)',
      'radial-gradient(1px 1px at 92% 40%, rgba(255,255,255,0.4) 0%, transparent 100%)',
      'radial-gradient(2px 2px at 25% 5%, rgba(255,220,180,0.5) 0%, transparent 100%)',
      'radial-gradient(2px 2px at 65% 14%, rgba(200,180,255,0.4) 0%, transparent 100%)',
    ].join(', '),
    pointerEvents: 'none',
  };

  const vignetteStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 35%, rgba(5,3,10,0.75) 100%)',
    pointerEvents: 'none',
  };

  const cardStyle: CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: cardMaxWidth,
    padding: cardPadding,
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'stretch',
    gap: isMobile ? 14 : 22,
  };

  const heroStyle: CSSProperties = {
    flex: isMobile ? '0 0 auto' : '1 1 52%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: isMobile ? '8px 8px 2px' : '12px 18px 12px 8px',
    minWidth: 0,
  };

  const logoWrapStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isMobile ? 190 : 320,
  };

  const heroCopyStyle: CSSProperties = {
    display: 'grid',
    gap: 0,
    justifyItems: 'center',
    maxWidth: isMobile ? '100%' : 360,
  };

  const subtitleStyle: CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: subtitleSize,
    color: 'var(--px-muted)',
    margin: 0,
    letterSpacing: 1.3,
    lineHeight: 1.7,
  };

  const actionPanelStyle: CSSProperties = {
    flex: isMobile ? '0 0 auto' : '1 1 48%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: isMobile ? 12 : 14,
    minWidth: 0,
    padding: isMobile ? '6px 0 0' : '4px 0 4px',
  };

  const actionsHeaderStyle: CSSProperties = {
    display: 'grid',
    gap: 8,
    textAlign: isMobile ? 'center' : 'left',
  };

  const actionsKickerStyle: CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: isMobile ? 8 : 9,
    color: 'var(--px-green-hi)',
    letterSpacing: 1.4,
    margin: 0,
  };

  const actionsTitleStyle: CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: isMobile ? 13 : 16,
    lineHeight: 1.6,
    color: 'var(--px-text)',
    margin: 0,
    textShadow: '2px 2px 0 #000',
  };

  const buttonsWrapStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: buttonGap,
  };

  const baseButtonStyle: CSSProperties = {
    width: '100%',
    minHeight: buttonMinHeight,
    justifyContent: 'center',
    letterSpacing: 2,
    fontSize: isMobile ? 13 : 14,
    padding: isMobile ? '14px 18px' : '16px 22px',
  };

  const primaryStyle: CSSProperties = {
    ...baseButtonStyle,
    background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 55%, #b45309 100%)',
    color: '#1a0a0a',
    borderTopColor: '#fde68a',
    borderLeftColor: '#fde68a',
    borderRightColor: '#78350f',
    borderBottomColor: '#78350f',
    textShadow: '1px 1px 0 rgba(255,255,255,0.25)',
    boxShadow: '3px 3px 0 #000, 0 0 18px rgba(251,191,36,0.35)',
    animation: 'px-menu-pulse 2.4s ease-in-out infinite',
  };

  const xButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #0a0710 0%, #160d26 100%)',
    color: 'var(--px-light)',
    textDecoration: 'none',
    width: isMobile ? 38 : 42,
    minWidth: isMobile ? 38 : 42,
    height: isMobile ? 38 : 42,
    minHeight: isMobile ? 38 : 42,
    padding: 0,
    flexShrink: 0,
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: isMobile ? 'center' : 'space-between',
    gap: 10,
    width: '100%',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: isMobile ? 8 : 9,
    color: 'var(--px-muted)',
    marginTop: isMobile ? 2 : 4,
    opacity: 0.7,
    letterSpacing: 1,
  };

  const footerCreditStyle: CSSProperties = {
    margin: 0,
    textAlign: isMobile ? 'center' : 'left',
  };

  const errorStyle: CSSProperties = {
    fontFamily: 'monospace',
    fontSize: isMobile ? 11 : 12,
    color: 'var(--px-red)',
    margin: 0,
  };

  return (
    <div
      className="main-menu-root"
      role="dialog"
      aria-modal="true"
      aria-label="Theme Park Vibes main menu"
      style={rootStyle}
    >
      <div style={starsStyle} />
      <div style={vignetteStyle} />

      <div className="px-panel px-anim-enter-up" style={cardStyle}>
        <div style={heroStyle}>
          <div style={logoWrapStyle}>
            <img
              src="/models/logo.png"
              alt="Theme Park Vibes"
              width={logoSize}
              height={logoSize}
              style={{
                width: logoSize,
                height: logoSize,
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 10px 32px rgba(251,113,133,0.35))',
              }}
              draggable={false}
            />
          </div>
          <div style={heroCopyStyle}>
            <p style={subtitleStyle}>Build your haunted theme park.</p>
          </div>
        </div>

        <div style={actionPanelStyle}>
          <div style={actionsHeaderStyle}>
            <p style={actionsKickerStyle}>START YOUR PARK</p>
            <p style={actionsTitleStyle}>Jump back in or begin a fresh nightmare.</p>
          </div>

          <div style={buttonsWrapStyle}>
            <button
              ref={newGameBtnRef}
              className="px-btn"
              style={primaryStyle}
              onClick={onNewGame}
              aria-label="Start a new game"
            >
              <Play />
              NEW GAME
            </button>

            <button
              className="px-btn"
              style={baseButtonStyle}
              onClick={handleLoadClick}
              aria-label="Load a save file"
            >
              <FolderOpen />
              LOAD GAME
            </button>

          </div>

          {errorMessage && <p role="alert" style={errorStyle}>{errorMessage}</p>}

          <div style={footerStyle}>
            <p style={footerCreditStyle}>by Seba Lopez</p>
            <a
              href="https://x.com/Sebalg_tech"
              target="_blank"
              rel="noopener noreferrer"
              className="px-btn"
              style={xButtonStyle}
              aria-label="Follow Sebalg on X"
            >
              <XLogo size={isMobile ? 15 : 16} />
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
    </div>
  );
}
