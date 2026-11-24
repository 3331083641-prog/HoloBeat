import React from 'react';
import { TopNavbar } from './components/layout/TopNavbar';
import { AudioBootBanner } from './components/ui/AudioBootBanner';
import { QuickDeckDrawer } from './components/ui/QuickDeckDrawer';
import { ToastStack } from './components/ui/ToastStack';
import { BeatDeckPage } from './pages/BeatDeckPage';
import { ForgePage } from './pages/ForgePage';
import { GachaPage } from './pages/GachaPage';
import { PinballPage } from './pages/PinballPage';
import { useHoloStore } from './store/useHoloStore';

export const App: React.FC = () => {
  const activePage = useHoloStore((s) => s.activePage);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden canvas-dot-grid">
      <TopNavbar />

      <main className="flex-1 min-h-0 overflow-hidden relative">
        <div key={activePage} className="w-full h-full animate-page-enter">
          {activePage === 'gacha' && <GachaPage />}
          {activePage === 'beat' && <BeatDeckPage />}
          {activePage === 'pinball' && <PinballPage />}
          {activePage === 'forge' && <ForgePage />}
        </div>
      </main>

      <AudioBootBanner />
      <QuickDeckDrawer />
      <ToastStack />
    </div>
  );
};

export default App;
