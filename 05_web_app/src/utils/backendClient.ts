import { buildMintIdempotencyKey } from '../../../shared/card-content.ts';
import { z } from 'zod';
import { createSchemas } from '../../../shared/card-schema.mjs';
import type { MintedCard } from '../types/holo';

const { MintedCardSchema } = createSchemas(z);
const base = ((import.meta as { env?: Record<string, string> }).env?.VITE_HOLOBEAT_API_URL || 'http://127.0.0.1:3789').replace(/\/+$/, '');
export interface ShareLinkResult {
  token: string;
  shareUrl: string;
  apiUrl: string;
  createdAt: number;
  expiresAt: number | null;
}
type FailureCode = 'TIMEOUT' | 'CANCELLED' | 'NETWORK' | 'BAD_RESPONSE' | 'HTTP' | 'MISSING_PARENT' | 'PARENT_METADATA_CONFLICT';
class ArchiveError extends Error {
  code: FailureCode;
  status?: number;
  constructor(code: FailureCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export type ArchiveResult =
  | { status: 'LOCAL_ONLY' | 'ARCHIVED' | 'REVOKED'; canonicalId?: string; archiveOutcome?: string }
  | { status: 'SHARED'; share: ShareLinkResult; canonicalId?: string; archiveOutcome?: string }
  | { status: 'SYNC_FAILED' | 'SHARE_FAILED'; error: string; code: FailureCode; httpStatus?: number };

async function request(path: string, init: RequestInit = {}, signal?: AbortSignal) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 5000);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  timeout.signal.addEventListener('abort', cancel);
  signal?.addEventListener('abort', cancel);
  if (signal?.aborted) cancel();
  try {
    const response = await fetch(base + path, { ...init, cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const code = ['MISSING_PARENT','PARENT_METADATA_CONFLICT'].includes(detail.code) ? detail.code : 'HTTP';
      throw new ArchiveError(code, detail.error ?? ('归档服务返回 HTTP ' + response.status), response.status);
    }
    let value;
    try {
      value = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ArchiveError('BAD_RESPONSE', '归档服务返回了无效 JSON');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ArchiveError('BAD_RESPONSE', '归档服务响应结构无效');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    if (signal?.aborted) throw new ArchiveError('CANCELLED', '请求已取消');
    if (timeout.signal.aborted) throw new ArchiveError('TIMEOUT', '本地归档服务请求超时');
    throw new ArchiveError('NETWORK', '无法连接本地归档服务');
  } finally {
    signal?.removeEventListener('abort', cancel);
    clearTimeout(timer);
    timeout.signal.removeEventListener('abort', cancel);
  }
}
async function writeOnce(path: string, method: string, body: unknown, signal?: AbortSignal) {
  const { writeToken } = await request('/api/session', {}, signal);
  if (typeof writeToken !== 'string' || !writeToken) throw new ArchiveError('BAD_RESPONSE', '本地写入凭证无效');
  return request(path, { method, headers: { 'X-HoloBeat-Write-Token': writeToken,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: JSON.stringify(body) }, signal);
}
// Cards are immutable and an active share with the same expiry is reused by the server.
async function write(path: string, method: string, body: unknown, signal?: AbortSignal) {
  try {
    return await writeOnce(path, method, body, signal);
  } catch (error) {
    const transient = error instanceof ArchiveError &&
      (error.code === 'NETWORK' || error.code === 'TIMEOUT' || error.status === 503);
    if (method !== 'POST' || !transient || signal?.aborted) throw error;
    return writeOnce(path, method, body, signal);
  }
}

function failure(status: 'SYNC_FAILED' | 'SHARE_FAILED', error: unknown): ArchiveResult {
  const e = error instanceof ArchiveError ? error : new ArchiveError('BAD_RESPONSE', '归档服务响应无效');
  return { status, error: e.message, code: e.code, httpStatus: e.status };
}
export async function checkBackendHealth(signal?: AbortSignal) {
  try {
    const h = await request('/api/health', {}, signal);
    return h.ok === true && typeof h.service === 'string' && typeof h.version === 'string' &&
      Number.isSafeInteger(h.cardsCount) ? h : null;
  } catch { return null; }
}
export async function createCardShare(cardId: string, expiresAt?: number, signal?: AbortSignal): Promise<ArchiveResult> {
  try {
    const s = await write('/api/shares', 'POST', { cardId, expiresAt }, signal);
    if (typeof s.token !== 'string' || !/^[\w-]+$/.test(s.token) ||
        typeof s.shareUrl !== 'string' || new URL(s.shareUrl).pathname !== '/share/' + s.token ||
        typeof s.createdAt !== 'number' || !Number.isSafeInteger(s.createdAt) ||
        !(s.expiresAt === null || Number.isSafeInteger(s.expiresAt))) {
      throw new ArchiveError('BAD_RESPONSE', '分享链接响应无效');
    }
    return { status: 'SHARED', share: {
      token: s.token, shareUrl: base + '/share/' + s.token, apiUrl: base + '/api/shares/' + s.token, createdAt: s.createdAt,
      expiresAt: s.expiresAt as number | null,
    } };
  } catch (error) { return failure('SHARE_FAILED', error); }
}
async function syncCard(card: MintedCard,
  options: { share?: boolean; localOnly?: boolean; signal?: AbortSignal; ancestors?: MintedCard[] } = {}): Promise<ArchiveResult> {
  if (options.localOnly) return { status: 'LOCAL_ONLY' };
  let canonical: MintedCard;
  let archiveOutcome: string | undefined;
  const visited = new Set<string>();
  const archive = async (work: MintedCard): Promise<MintedCard> => {
    if (visited.has(work.id)) throw new ArchiveError('PARENT_METADATA_CONFLICT','作品谱系存在循环');
    visited.add(work.id);
    let outgoing = work;
    if (work.parentCardId) {
      const parent = options.ancestors?.find(c => (c.id === work.parentCardId || c.workId === work.parentCardId));
      if (parent) {
        if (parent.title !== work.parentTitle || parent.code !== work.parentCode || parent.lineageDepth+1 !== work.lineageDepth)
          throw new ArchiveError('PARENT_METADATA_CONFLICT','本地原作与重混来源不一致，请恢复正确原作');
        const savedParent = await archive(parent);
        outgoing = {...work,parentCardId:savedParent.id,parentTitle:savedParent.title,parentCode:savedParent.code};
        outgoing.contentHash = await buildMintIdempotencyKey(outgoing);
      }
      // If the parent is absent locally the server may still have it; otherwise it returns MISSING_PARENT.
    }
    const saved = await write('/api/cards','POST',outgoing,options.signal);
    const parsed = MintedCardSchema.safeParse(saved.card);
    if (typeof saved.created !== 'boolean' || !parsed.success ||
        await buildMintIdempotencyKey(parsed.data) !== await buildMintIdempotencyKey(outgoing) ||
        parsed.data.lineageDepth !== outgoing.lineageDepth ||
        parsed.data.parentTitle !== outgoing.parentTitle || parsed.data.parentCode !== outgoing.parentCode) {
      throw new ArchiveError('BAD_RESPONSE','归档内容验证失败；请用完整原件修复历史裁剪档案');
    }
    archiveOutcome = typeof saved.outcome === "string" ? saved.outcome : undefined;
    return parsed.data;
  };
  try { canonical = await archive(card); }
  catch (error) { return failure('SYNC_FAILED', error); }
  if (options.share === false) return { status:'ARCHIVED', canonicalId:canonical.id, archiveOutcome };
  const shared = await createCardShare(canonical.id,undefined,options.signal);
  return shared.status === 'SHARED' ? {...shared,canonicalId:canonical.id,archiveOutcome} : shared;
}
// Preserve the redesign's existing Forge controls, including its error toast and HTML exhibit URL.
export async function syncCardToBackend(card: MintedCard, options: Parameters<typeof syncCard>[1] = {}) {
  const result = await syncCard(card, options);
  return {
    ...result,
    ok: result.status === 'ARCHIVED' || result.status === 'SHARED',
    share: result.status === 'SHARED' ? result.share : undefined,
    error: result.status === 'SHARE_FAILED' ? '作品已成功归档，但分享链接创建失败。' :
      result.status === 'SYNC_FAILED' ? result.error : undefined,
  };
}

export async function revokeCardShare(token: string, signal?: AbortSignal): Promise<ArchiveResult> {
  try {
    const res = await write('/api/shares/' + encodeURIComponent(token), 'DELETE', undefined, signal);
    if (res.revoked !== true) throw new ArchiveError('BAD_RESPONSE', '分享撤销状态未知');
    return { status: 'REVOKED' };
  } catch (err) { return failure('SHARE_FAILED', err); }
}
export async function fetchSharedCard(token: string, signal?: AbortSignal): Promise<MintedCard | null> {
  try {
    const { card } = await request('/api/shares/' + encodeURIComponent(token), {}, signal);
    const parsed = MintedCardSchema.safeParse(card);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

/** Explicit owner action only: never silently invent missing historical music. */
export async function repairArchivedCard(fullOriginal: MintedCard, signal?: AbortSignal): Promise<ArchiveResult> {
  try {
    const result = await write('/api/cards/'+encodeURIComponent(fullOriginal.id)+'/repair','POST',fullOriginal,signal);
    const parsed = MintedCardSchema.safeParse(result.card);
    if (result.repaired !== true || !parsed.success ||
        await buildMintIdempotencyKey(parsed.data) !== await buildMintIdempotencyKey(fullOriginal))
      throw new ArchiveError('BAD_RESPONSE','归档修复校验失败');
    return {status:'ARCHIVED'};
  } catch(error) { return failure('SYNC_FAILED',error); }
}
