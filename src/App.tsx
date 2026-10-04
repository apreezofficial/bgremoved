import React from 'react';
import { useAppStore } from './store/useAppStore';
import { HomeScreen } from './screens/HomeScreen';
import { EditorScreen } from './screens/EditorScreen';
import { ExportScreen } from './screens/ExportScreen';

export default function App() {
  const { screen } = useAppStore();

  return (
    <div className="w-full h-full overflow-hidden bg-bg text-fg">
      {screen === 'home' && <HomeScreen />}
      {screen === 'editor' && <EditorScreen />}
      {screen === 'export' && <ExportScreen />}
    </div>
  );
}
