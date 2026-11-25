import type { MintedCard } from '../types/holo';

const DEFAULT_API_BASE = 'http://127.0.0.1:3789';

export interface BackendHealth {
  ok: boolean;
  service: string;
  version: string;
  cardsCount: number;
}

export interface ShareLinkResult {
  token: string;
  shareUrl: string;
  createdAt: number;
}

function getApiBase(): string {
  const custom = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_HOLOBEAT_API_URL;
  return custom || DEFAULT_API_BASE;
}

/**
 * Optional local archive backend client.
 * Never called automatically on page load so 100% offline usage produces ZERO console network errors.
 */
export async function checkBackendHealth(): Promise<BackendHealth | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${getApiBase()}/api/health`, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as BackendHealth;
  } catch {
    return null;
  }
}

export async function syncCardToBackend(
  card: MintedCard
): Promise<{ ok: boolean; share?: ShareLinkResult; error?: string }> {
  try {
    const saveRes = await fetch(`${getApiBase()}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!saveRes.ok) {
      return { ok: false, error: `HTTP ${saveRes.status}` };
    }
    const shareRes = await fetch(`${getApiBase()}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: card.id }),
    });
    if (!shareRes.ok) {
      return { ok: true };
    }
    const share = (await shareRes.json()) as ShareLinkResult;
    return { ok: true, share };
  } catch {
    return {
      ok: false,
      error: '本地归档服务未启动（离线模式完全正常；如需云端/局域网分享可启动 06_backend）',
    };
  }
}

export async function fetchSharedCard(token: string): Promise<MintedCard | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/shares/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const payload = (await res.json()) as { card?: MintedCard };
    return payload.card ?? null;
  } catch {
    return null;
  }
}
