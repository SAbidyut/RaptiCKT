// Reads a circuit diagram off a picture with Claude (vision + structured JSON output), using the
// reader's own Anthropic API key straight from the app — there is no RaptiCKT server.

import Anthropic from '@anthropic-ai/sdk';
import { PHOTO_PROMPT, PHOTO_SCHEMA } from './photo-circuit.js';
import { bridge } from './store.js';

export const PHOTO_MODEL = 'claude-opus-5-5';

/** A failure the reader can act on: `code` picks the advice shown. */
export class PhotoError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * Send one picture (base64, without the data: prefix) and get back { circuits, problem } as
 * described by PHOTO_SCHEMA. onProgress(chars) reports how much has arrived so far.
 */
export async function readCircuitPhoto({ apiKey, data, mediaType = 'image/jpeg', signal, onProgress }) {
  if (!apiKey) throw new PhotoError('key', 'An Anthropic API key is needed.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, fetch: bridge.apiFetch() });
  let message;
  try {
    const stream = client.beta.messages.stream({
      model: PHOTO_MODEL,
      max_tokens: 32000,
      // if the model declines for policy reasons, the API retries on its default fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: PHOTO_PROMPT,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: PHOTO_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: 'Read the circuit diagram(s) in this picture.' },
        ],
      }],
    }, { signal });
    let got = 0;
    stream.on('text', (t) => { got += t.length; onProgress?.(got); });
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) throw new PhotoError('cancelled', 'Cancelled.');
    if (e instanceof Anthropic.AuthenticationError) throw new PhotoError('key', 'The API key was not accepted. Check it and try again.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new PhotoError('key', 'This API key may not use this model.');
    if (e instanceof Anthropic.RateLimitError) throw new PhotoError('busy', 'Too many requests just now (or the key has no credit left). Wait a little and try again.');
    if (e instanceof Anthropic.APIConnectionError) throw new PhotoError('net', 'Could not reach the Claude API. Check the internet connection.');
    if (e instanceof Anthropic.BadRequestError) throw new PhotoError('bad', `The picture could not be sent: ${e.message}`);
    if (e instanceof Anthropic.APIError) throw new PhotoError('api', `The Claude API returned an error (${e.status ?? '?'}). Try again later.`);
    throw new PhotoError('api', String(e && e.message ? e.message : e));
  }
  if (message.stop_reason === 'refusal') throw new PhotoError('refused', 'Claude declined to read this picture.');
  if (message.stop_reason === 'max_tokens') throw new PhotoError('big', 'The picture holds more than can be read at once. Crop it to one circuit and try again.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    const out = JSON.parse(text);
    if (!out || !Array.isArray(out.circuits)) throw new Error('no circuits');
    return out;
  } catch {
    throw new PhotoError('api', 'The answer could not be understood. Try again.');
  }
}
