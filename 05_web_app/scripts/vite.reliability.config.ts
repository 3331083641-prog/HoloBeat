import { defineConfig, mergeConfig } from 'vite';
import studio from '../vite.config';

// A network fault test intentionally disconnects and reconnects the browser.
// The development HMR client would reload the studio right in the middle of minting.
export default mergeConfig(studio, defineConfig({ server: { hmr: false, watch: null } }));
