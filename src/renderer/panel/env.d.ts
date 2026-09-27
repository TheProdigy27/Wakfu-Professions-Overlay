/// <reference types="vite/client" />
import type { PanelApi } from '../../preload/api';

declare global {
  interface Window {
    api: PanelApi;
  }
}
