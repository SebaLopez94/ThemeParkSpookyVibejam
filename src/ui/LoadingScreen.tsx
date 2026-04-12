import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onDone: () => void;
}

export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Simulate asset loading progress tied to document readyState + font load
    let raf: number;
    let target = 0;

    const advance = () => {
      setProgress(prev => {
        const next = Math.min(prev + (target - prev) * 0.08 + 0.3, target);
        return next;
      });
      raf = requestAnimationFrame(advance);
    };

    // Phase 1: jump to 40% quickly (HTML parsed)
    target = 40;
    raf = requestAnimationFrame(advance);

    // Phase 2: fonts loaded → 75%
    document.fonts.ready.then(() => { target = 75; });

    // Phase 3: full page load → 100%
    const finish = () => {
      target = 100;
      setTimeout(() => {
        cancelAnimationFrame(raf);
        setProgress(100);
        setDone(true);
        setTimeout(onDone, 420); // wait for fade-out
      }, 300);
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('load', finish);
    };
  }, [onDone]);

  return (
    <div className={`px-loading${done ? ' px-loading--done' : ''}`} aria-live="polite" aria-label="Loading game">
      <div className="px-loading__logo">
        <img src="/models/logo.png" alt="Theme Park Vibes: Haunted Tycoon" style={{ maxWidth: '80%', maxHeight: '40vh', objectFit: 'contain', margin: '0 auto 1.5rem auto', display: 'block' }} />
      </div>
      <div className="px-loading__bar-wrap" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="px-loading__bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="px-loading__sub" style={{ fontSize: 'clamp(7px, 1.5vw, 9px)', opacity: 0.5 }}>
        {progress < 100 ? 'LOADING...' : 'READY'}
      </div>
    </div>
  );
}
