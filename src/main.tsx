import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';
import { LoadingScreen } from './ui/LoadingScreen.tsx';
import './index.css';

function Root() {
  const [loaded, setLoaded] = useState(false);
  return (
    <ErrorBoundary>
      {!loaded && <LoadingScreen onDone={() => setLoaded(true)} />}
      <App />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
