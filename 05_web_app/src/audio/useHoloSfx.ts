import { useCallback } from 'react';
import { holoAudio } from './HoloAudioEngine';

export type HoloSfxKind =
  | 'tab'
  | 'click'
  | 'ratchet'
  | 'capsuleDrop'
  | 'scratch'
  | 'cartridgeLock'
  | 'knobTick'
  | 'holoFanfare'
  | 'mintStamp'
  | 'portalWarp';

export function useHoloSfx() {
  return useCallback((kind: HoloSfxKind, param = 0.5) => {
    void holoAudio.playSfx(kind, param);
  }, []);
}
