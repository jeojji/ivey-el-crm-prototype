// Browser side of local AI. Talks only to this app's own local backend (/local-ai/*), never to
// any other server. In the GitHub Pages demo (VITE_DEMO_MODE=true) no request is ever made.
import { MalformedResponseError, validateExtraction, type EmailInput, type ExtractResponse, type StatusResponse } from './extraction';
import { validateBrief, type BriefRequest, type BriefResponse } from './brief';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const CLIENT_TIMEOUT_MS = 150_000;

export type AiAvailability =
  | { state: 'checking' }
  | { state: 'demo' }
  | { state: 'available'; model: string }
  | { state: 'unavailable'; reason: string };

export async function checkLocalAi(): Promise<AiAvailability> {
  if (DEMO_MODE) return { state: 'demo' };
  try {
    const res = await fetch('/local-ai/status', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      return { state: 'unavailable', reason: 'The local AI backend isn’t running here. Start the app with “npm run dev” on the computer that has Ollama.' };
    }
    const s = (await res.json()) as StatusResponse;
    return s.available ? { state: 'available', model: s.model } : { state: 'unavailable', reason: s.reason ?? 'Local AI is unavailable.' };
  } catch {
    return { state: 'unavailable', reason: 'The local AI backend isn’t reachable.' };
  }
}

export async function extractEmail(input: EmailInput, cancel: AbortSignal): Promise<ExtractResponse> {
  if (DEMO_MODE) return { ok: false, code: 'unavailable', message: 'Local AI isn’t available in the online demo.' };
  const signal = AbortSignal.any([cancel, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]);
  let res: Response;
  try {
    res = await fetch('/local-ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    if (cancel.aborted) return { ok: false, code: 'error', message: 'Cancelled.' };
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return { ok: false, code: 'timeout', message: 'No answer from the local model in time. Fill in the details by hand, or try again.' };
    }
    return { ok: false, code: 'unavailable', message: 'The local AI backend isn’t reachable.' };
  }
  let data: ExtractResponse;
  try {
    data = (await res.json()) as ExtractResponse;
  } catch {
    return { ok: false, code: 'malformed', message: 'The local AI backend sent an unreadable answer.' };
  }
  if (!data.ok) return data;
  // Defence in depth: check the answer again against the email in the browser.
  try {
    const again = validateExtraction(data.extraction, input.originalText);
    return { ...data, extraction: again.extraction, warnings: [...new Set([...data.warnings, ...again.warnings])] };
  } catch (err) {
    return { ok: false, code: 'malformed', message: err instanceof MalformedResponseError ? err.message : 'The answer couldn’t be checked.' };
  }
}

const BRIEF_CLIENT_TIMEOUT_MS = 270_000;

/** Asks the local backend for a brief, then re-checks every citation in the browser. */
export async function generateBrief(req: BriefRequest, cancel: AbortSignal): Promise<BriefResponse> {
  if (DEMO_MODE) return { ok: false, code: 'unavailable', message: 'Local AI isn’t available in the online demo.' };
  const signal = AbortSignal.any([cancel, AbortSignal.timeout(BRIEF_CLIENT_TIMEOUT_MS)]);
  let res: Response;
  try {
    res = await fetch('/local-ai/brief', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(req), signal });
  } catch (err) {
    if (cancel.aborted) return { ok: false, code: 'error', message: 'Cancelled.' };
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return { ok: false, code: 'timeout', message: 'No answer from the local model in time. Try again with fewer records.' };
    return { ok: false, code: 'unavailable', message: 'The local AI backend isn’t reachable.' };
  }
  let data: BriefResponse;
  try {
    data = (await res.json()) as BriefResponse;
  } catch {
    return { ok: false, code: 'malformed', message: 'The local AI backend sent an unreadable answer.' };
  }
  if (!data.ok) return data;
  try {
    const again = validateBrief(data.content, req.sources);
    const checks = [...new Set([...(data.content.suggestionChecks ?? []), ...(again.content.suggestionChecks ?? [])])];
    return { ...data, content: { ...again.content, suggestionChecks: checks }, warnings: [...new Set([...data.warnings, ...again.warnings])], flaggedSources: again.flaggedSources };
  } catch (err) {
    return { ok: false, code: 'malformed', message: err instanceof MalformedResponseError ? err.message : 'The answer couldn’t be checked.' };
  }
}
