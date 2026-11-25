import React, { useEffect } from 'react';
import { holoAudio } from './audio/HoloAudioEngine';
import { TopNavbar } from './components/layout/TopNavbar';
import { AudioBootBanner } from './components/ui/AudioBootBanner';
import { QuickDeckDrawer } from './components/ui/QuickDeckDrawer';
import { SharedCardFlightOverlay } from './components/ui/SharedCardFlightOverlay';
import { ToastStack } from './components/ui/ToastStack';
import { BeatDeckPage } from './pages/BeatDeckPage';
import { ForgePage } from './pages/ForgePage';
import { GachaPage } from './pages/GachaPage';
import { PinballPage } from './pages/PinballPage';
import { useHoloStore } from './store/useHoloStore';

export const App: React.FC = () => {
  const activePage = useHoloStore((s) => s.activePage);
  const reducedMotion = useHoloStore((s) => s.reducedMotion);
  const hydrateFromIndexedDb = useHoloStore((s) => s.hydrateFromIndexedDb);
  const resetMomentaryFx = useHoloStore((s) => s.resetMomentaryFx);

  // Hydrate persistent IndexedDB minted archive & forge draft safely on boot
  useEffect(() => {
    void hydrateFromIndexedDb();
  }, [hydrateFromIndexedDb]);

  // Cleanly halt isolated snapshot audio & reset momentary FX when switching pages
  useEffect(() => {
    holoAudio.stopSnapshotPlayback();
    holoAudio.stopPinballRecording();
    resetMomentaryFx();
  }, [activePage, resetMomentaryFx]);

  useEffect(() => {
    const onUnload = () => {
      holoAudio.stopAllPlayback();
    };
    const onBlur = () => {
      resetMomentaryFx();
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('blur', onBlur);
    };
  }, [resetMomentaryFx]);

  return (
    <div
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="w-screen h-screen flex flex-col overflow-hidden canvas-dot-grid"
    >
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
      <SharedCardFlightOverlay />
      <QuickDeckDrawer />
      <ToastStack />
    </div>
  );
};

export default App;
