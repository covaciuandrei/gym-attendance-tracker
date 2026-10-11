import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AnalysisResult } from '../models';
import { dataUrlBase64 } from '../utils/image';

const REQUEST_TIMEOUT_MS = 50_000;
// Static Web Apps replaces the standard Authorization header, so the Firebase ID token uses a custom header.
const TOKEN_HEADER = 'x-firebase-token';

export type AiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'offline'
  | 'network'
  | 'timeout'
  | 'busy'
  | 'rate_limited'
  | 'too_many_attempts'
  | 'not_configured'
  | 'blocked'
  | 'rejected'
  | 'too_large'
  | 'invalid_input'
  | 'unavailable'
  | 'unknown';

export class AiError extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code);
    this.name = 'AiError';
  }
}

export interface AnalyzeInput {
  /** JPEG/PNG/WebP data URL of the meal, if any. */
  photo?: string | null;
  note: string;
  lang: string;
}

export function mapFailure(status: number, error: string | undefined): AiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 429) {
    if (error === 'too_many_attempts') return 'too_many_attempts';
    return error === 'rate_limited' ? 'rate_limited' : 'busy';
  }
  if (status === 503) return error === 'auth_unavailable' || error === 'access_unavailable' ? 'unavailable' : 'not_configured';
  if (status === 413) return 'too_large';
  if (status === 422) return error === 'ai_blocked' ? 'blocked' : 'rejected';
  if (status === 400) return 'invalid_input';
  if (status === 502 || status === 404 || status === 504) return 'unavailable';
  return 'unknown';
}

/**
 * Calls the /api/analyze function. The Gemini key stays on the server; the browser only proves who is signed in
 * with a short-lived Firebase ID token that the server verifies.
 */
@Injectable({ providedIn: 'root' })
export class NutritionAiService {
  private auth = inject(AuthService);

  async analyze(input: AnalyzeInput): Promise<AnalysisResult> {
    if (!navigator.onLine) throw new AiError('offline');

    const payload: Record<string, unknown> = { note: input.note, lang: input.lang };
    if (input.photo) {
      payload['image'] = dataUrlBase64(input.photo);
      payload['mimeType'] = /^data:(image\/[a-z]+);/.exec(input.photo)?.[1] ?? 'image/jpeg';
    }
    const body = JSON.stringify(payload);

    let res = await this.post(body, false);
    // The cached token may have been revoked or be about to expire: try once more with a fresh one.
    if (res.status === 401) res = await this.post(body, true);

    const json = await this.readJson(res);
    if (!res.ok) throw new AiError(mapFailure(res.status, json?.error));
    if (!json || typeof json !== 'object' || !Array.isArray(json.items)) throw new AiError('unknown');
    return json as AnalysisResult;
  }

  private async post(body: string, forceRefresh: boolean): Promise<Response> {
    const user = this.auth.getFirebaseAuth()?.currentUser;
    if (!user) throw new AiError('unauthorized');

    let token: string;
    try {
      token = await user.getIdToken(forceRefresh);
    } catch {
      throw new AiError(navigator.onLine ? 'unauthorized' : 'offline');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [TOKEN_HEADER]: token },
        body,
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new AiError('timeout');
      throw new AiError(navigator.onLine ? 'network' : 'offline');
    } finally {
      clearTimeout(timer);
    }
  }

  private async readJson(res: Response): Promise<any> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}
