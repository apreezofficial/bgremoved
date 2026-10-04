import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { HomeScreen } from './screens/HomeScreen';
import { EditorScreen } from './screens/EditorScreen';
import { ExportScreen } from './screens/ExportScreen';

export default function App() {
  const { screen } = useAppStore();

  // System theme detection (light/dark based on OS)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const setDark = (e: MediaQueryListEvent | MediaQueryList) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    setDark(media);
    media.addEventListener('change', setDark);
    return () => media.removeEventListener('change', setDark);
  }, []);

  return (
    <div className="w-full h-full overflow-hidden bg-bg text-fg">
      {screen === 'home' && <HomeScreen />}
      {screen === 'editor' && <EditorScreen />}
      {screen === 'export' && <ExportScreen />}
    </div>
  );
}
