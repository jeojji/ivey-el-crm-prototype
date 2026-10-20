// Small local backend for AI extraction, mounted inside the Vite dev/preview server at /local-ai/*.
// It talks only to an Ollama runtime on this computer (127.0.0.1). There is no cloud AI and no
// cloud fallback: if the local model is unavailable, the request fails and the form is filled by hand.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  EXTRACTION_SCHEMA,
  MAX_EMAIL_CHARS,
  MalformedResponseError,
  SYSTEM_PROMPT,
  buildUserPrompt,
  validateExtraction,
  type EmailInput,
  type ExtractResponse,
  type StatusResponse,
} from '../src/ai/extraction';
import { BRIEF_SCHEMA, BRIEF_SYSTEM_PROMPT, MAX_SOURCES, buildBriefPrompt, validateBrief, type BriefRequest, type BriefResponse } from '../src/ai/brief';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const MAX_BODY_BYTES = 400_000;
/** One context size for every request, so Ollama doesn't reload the model when switching tasks. */
const NUM_CTX = 16384;

export interface LocalAiOptions {
  ollamaUrl?: string;
  model?: string;
  timeoutMs?: number;
  briefTimeoutMs?: number;
}

function config(opts: LocalAiOptions) {
  const ollamaUrl = (opts.ollamaUrl ?? process.env.LOCAL_AI_OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  const host = new URL(ollamaUrl).hostname;
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Local AI: refusing to use "${ollamaUrl}". Only an Ollama runtime on this computer (127.0.0.1) is allowed.`);
  }
  return {
    ollamaUrl,
    model: opts.model ?? process.env.LOCAL_AI_MODEL ?? 'qwen2.5:7b',
    timeoutMs: Number(opts.timeoutMs ?? process.env.LOCAL_AI_TIMEOUT_MS ?? 120_000),
    briefTimeoutMs: Number(opts.briefTimeoutMs ?? process.env.LOCAL_AI_BRIEF_TIMEOUT_MS ?? 240_000),
  };
}

/** Ollama can proxy "cloud" models; those would send data off this computer, so they're refused. */
function isCloudModel(name: string, entry?: Record<string, unknown>): boolean {
  return /(^|[:-])cloud\b/i.test(name) || !!entry?.remote_host || !!entry?.remote_model;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getStatus(opts: LocalAiOptions = {}): Promise<StatusResponse> {
  const c = config(opts);
  if (isCloudModel(c.model)) return { available: false, model: c.model, reason: 'Cloud models are not allowed. Choose a model that runs on this computer.' };
  try {
    const res = await fetchWithTimeout(`${c.ollamaUrl}/api/tags`, {}, 3000);
    if (!res.ok) return { available: false, model: c.model, reason: `Ollama answered with an error (${res.status}).` };
    const data = (await res.json()) as { models?: Record<string, unknown>[] };
    const entry = data.models?.find((m) => m.name === c.model || m.model === c.model);
    if (!entry) return { available: false, model: c.model, reason: `The model “${c.model}” isn’t downloaded yet. Run: ollama pull ${c.model}` };
    if (isCloudModel(c.model, entry)) return { available: false, model: c.model, reason: 'This model runs in the cloud, which isn’t allowed.' };
    return { available: true, model: c.model };
  } catch {
    return { available: false, model: c.model, reason: 'Ollama isn’t running on this computer. Start it, then try again.' };
  }
}

function parseInput(body: unknown): EmailInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  if (!str('originalText').trim()) return null;
  return {
    originalText: str('originalText'),
    subject: str('subject').slice(0, 300),
    fromName: str('fromName').slice(0, 200),
    fromEmail: str('fromEmail').slice(0, 200),
    to: str('to').slice(0, 500),
    date: str('date').slice(0, 40),
    forwardedTicked: b.forwardedTicked === true,
    direction: b.direction === 'sent' ? 'sent' : 'received',
  };
}

type ModelCall = { ok: true; content: string; durationMs: number; model: string } | { ok: false; code: 'unavailable' | 'model-missing' | 'timeout' | 'malformed' | 'error'; message: string };

/** One structured-output request to the local model, with every failure turned into a plain message. */
async function callModel(opts: LocalAiOptions, req: { schema: object; system: string; user: string; numPredict: number; timeoutMs: number }): Promise<ModelCall> {
  const c = config(opts);
  const status = await getStatus(opts);
  if (!status.available) {
    return { ok: false, code: status.reason?.includes('isn’t downloaded') ? 'model-missing' : 'unavailable', message: status.reason ?? 'Local AI is unavailable.' };
  }
  const started = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${c.ollamaUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: c.model,
          stream: false,
          format: req.schema,
          keep_alive: '15m',
          // No repeat penalty: answers must copy text verbatim. num_predict + schema limits stop runaway output.
          options: { temperature: 0, seed: 7, num_ctx: NUM_CTX, num_predict: req.numPredict },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
      },
      req.timeoutMs,
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, code: 'timeout', message: `The local model didn’t answer within ${Math.round(req.timeoutMs / 1000)} seconds. Try again with fewer records, or continue by hand.` };
    }
    return { ok: false, code: 'unavailable', message: 'Lost the connection to Ollama. Check that it’s still running.' };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404 || /not found/i.test(text)) return { ok: false, code: 'model-missing', message: `The model “${c.model}” isn’t available in Ollama.` };
    return { ok: false, code: 'error', message: `Ollama returned an error (${res.status}).` };
  }
  try {
    const data = (await res.json()) as { message?: { content?: unknown }; done_reason?: string };
    if (data.done_reason === 'length') return { ok: false, code: 'malformed', message: 'The model’s answer was cut off (it started repeating itself). Try again.' };
    if (typeof data.message?.content !== 'string') return { ok: false, code: 'malformed', message: 'The model returned no content.' };
    return { ok: true, content: data.message.content, durationMs: Date.now() - started, model: c.model };
  } catch {
    return { ok: false, code: 'malformed', message: 'The model’s answer couldn’t be read.' };
  }
}

function parseBriefRequest(body: unknown): BriefRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const f = (b.focus && typeof b.focus === 'object' ? b.focus : {}) as Record<string, unknown>;
  const sstr = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  if (!Array.isArray(b.sources) || b.sources.length === 0) return null;
  const sources = b.sources.slice(0, MAX_SOURCES).flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.text !== 'string') return [];
    const kind = ['company', 'contact', 'application', 'activity', 'task'].includes(r.kind as string) ? (r.kind as BriefRequest['sources'][number]['kind']) : 'activity';
    return [{ id: sstr(r.id, 6), kind, recordId: sstr(r.recordId, 80), label: sstr(r.label, 200), text: sstr(r.text, 5000), updatedAt: sstr(r.updatedAt, 40) }];
  });
  if (!sources.length) return null;
  return {
    focus: { companyName: sstr(f.companyName, 200), contactName: sstr(f.contactName, 200), contactFirstName: sstr(f.contactFirstName, 100), applicationTitle: sstr(f.applicationTitle, 200), doNotContact: f.doNotContact === true },
    today: sstr(b.today, 20),
    sources,
  };
}

export async function brief(body: unknown, opts: LocalAiOptions = {}): Promise<BriefResponse> {
  const req = parseBriefRequest(body);
  if (!req) return { ok: false, code: 'bad-request', message: 'Choose at least one record to base the brief on.' };
  const c = config(opts);
  const call = await callModel(opts, { schema: BRIEF_SCHEMA, system: BRIEF_SYSTEM_PROMPT, user: buildBriefPrompt(req), numPredict: 1800, timeoutMs: c.briefTimeoutMs });
  if (!call.ok) return call;
  try {
    const v = validateBrief(call.content, req.sources);
    return { ok: true, content: v.content, warnings: v.warnings, flaggedSources: v.flaggedSources, stats: v.stats, model: call.model, durationMs: call.durationMs };
  } catch (err) {
    return { ok: false, code: 'malformed', message: `${err instanceof MalformedResponseError ? err.message : 'The model’s answer couldn’t be read.'} Try again.` };
  }
}

export async function extract(body: unknown, opts: LocalAiOptions = {}): Promise<ExtractResponse> {
  const c = config(opts);
  const input = parseInput(body);
  if (!input) return { ok: false, code: 'bad-request', message: 'Paste the email message first.' };
  const call = await callModel(opts, { schema: EXTRACTION_SCHEMA, system: SYSTEM_PROMPT, user: buildUserPrompt(input), numPredict: 900, timeoutMs: c.timeoutMs });
  if (!call.ok) return call.code === 'timeout' ? { ...call, message: `The local model didn’t answer within ${Math.round(c.timeoutMs / 1000)} seconds. Try again, or fill in the details by hand.` } : call;
  try {
    const { extraction, warnings } = validateExtraction(call.content, input.originalText);
    return { ok: true, extraction, warnings, model: call.model, durationMs: call.durationMs, truncated: input.originalText.length > MAX_EMAIL_CHARS };
  } catch (err) {
    if (err instanceof MalformedResponseError) return { ok: false, code: 'malformed', message: `${err.message} Try again, or fill in the details by hand.` };
    return { ok: false, code: 'malformed', message: 'The model’s answer couldn’t be read. Try again, or fill in the details by hand.' };
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('too-large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Only requests from this computer, from the app's own page, are served. */
function allowed(req: IncomingMessage): boolean {
  if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? '')) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!LOOPBACK_HOSTS.has(new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function localAiPlugin(opts: LocalAiOptions = {}): Plugin {
  config(opts); // fail fast on a non-local Ollama URL
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/local-ai/')) return next();
    if (!allowed(req)) return send(res, 403, { ok: false, code: 'error', message: 'Local AI only accepts requests from this computer.' });
    try {
      if (req.method === 'GET' && req.url === '/local-ai/status') return send(res, 200, await getStatus(opts));
      if (req.method === 'POST' && req.url === '/local-ai/extract') {
        if (!String(req.headers['content-type']).includes('application/json')) return send(res, 415, { ok: false, code: 'bad-request', message: 'Expected JSON.' });
        let body: unknown;
        try {
          body = await readJson(req);
        } catch {
          return send(res, 400, { ok: false, code: 'bad-request', message: 'The request couldn’t be read (too large or not JSON).' });
        }
        return send(res, 200, await extract(body, opts));
      }
      if (req.method === 'POST' && req.url === '/local-ai/brief') {
        if (!String(req.headers['content-type']).includes('application/json')) return send(res, 415, { ok: false, code: 'bad-request', message: 'Expected JSON.' });
        let body: unknown;
        try {
          body = await readJson(req);
        } catch {
          return send(res, 400, { ok: false, code: 'bad-request', message: 'The request couldn’t be read (too large or not JSON).' });
        }
        return send(res, 200, await brief(body, opts));
      }
      return send(res, 404, { ok: false, code: 'error', message: 'Unknown local AI endpoint.' });
    } catch {
      return send(res, 500, { ok: false, code: 'error', message: 'Local AI failed unexpectedly.' });
    }
  };
  return {
    name: 'el-local-ai',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
