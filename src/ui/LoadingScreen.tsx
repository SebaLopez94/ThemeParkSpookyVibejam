import { useEffect, useRef, useState } from 'react';

interface LoadingScreenProps {
  onDone: () => void;
  mode?: 'boot' | 'transition';
}

export function LoadingScreen({ onDone, mode = 'boot' }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    let raf = 0;
    let target = 0;

    const queueTimeout = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      timeoutsRef.current.push(id);
    };

    const advance = () => {
      setProgress(prev => Math.min(prev + (target - prev) * 0.08 + 0.3, target));
      raf = requestAnimationFrame(advance);
    };

    const finish = () => {
      target = 100;
      queueTimeout(() => {
        cancelAnimationFrame(raf);
        setProgress(100);
        setDone(true);
        queueTimeout(onDone, 420);
      }, 300);
    };

    if (mode === 'transition') {
      target = 32;
      raf = requestAnimationFrame(advance);
      queueTimeout(() => { target = 68; }, 120);
      queueTimeout(() => { target = 88; }, 360);
      queueTimeout(finish, 720);
    } else {
      // Simulate asset loading progress tied to document readyState + font load
      target = 40;
      raf = requestAnimationFrame(advance);

      document.fonts.ready.then(() => { target = 75; });

      if (document.readyState === 'complete') {
        finish();
      } else {
        window.addEventListener('load', finish, { once: true });
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      timeoutsRef.current.forEach(id => window.clearTimeout(id));
      timeoutsRef.current = [];
      window.removeEventListener('load', finish);
    };
  }, [mode, onDone]);

  return (
    <div
      className={`px-loading${done ? ' px-loading--done' : ''}`}
      aria-live="polite"
      aria-label={mode === 'transition' ? 'Loading save' : 'Loading game'}
    >
      <div className="px-loading__logo">
        <img
          src="/models/logo.png"
          alt="Theme Park Vibes: Haunted Tycoon"
          style={{ maxWidth: '80%', maxHeight: '40vh', objectFit: 'contain', margin: '0 auto 1.5rem auto', display: 'block' }}
        />
      </div>
      <div
        className="px-loading__bar-wrap"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="px-loading__bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="px-loading__sub" style={{ fontSize: 'clamp(7px, 1.5vw, 9px)', opacity: 0.5 }}>
        {progress < 100 ? (mode === 'transition' ? 'LOADING SAVE...' : 'LOADING...') : 'READY'}
      </div>
    </div>
  );
}
