// Circuit from photo, end to end. On the phone (the default, no network): a textbook-style photo
// → the redrawn circuit → open on the board → Run gives the answer. With Claude (API faked):
// the API key → a picture → the redrawn circuit (a page of two, pick one) → the board. Once in
// the browser (the page's own fetch, a chosen file) and once as in the Android app (camera
// picture and HTTP through the native bridge, no fetch from the page). Cancel, a refused key and
// "Read with Claude AI" after a reading on the phone are checked too.
// Usage: npm run build && node tests/photo-ui.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
// (fs and path also load the test picture from tests/fixtures)

const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const URL0 = `http://127.0.0.1:${server.address().port}/`;
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fail++; };

// ------------------------------------------------------------------ what "Claude" answers
const P = (x, y) => ({ x, y });
const part = (kind, text, value, from, to, polarity = 'none', control = '') => ({ kind, text, value, from, to, polarity, control });
const FIG1 = {
  title: 'Fig. 1 — find vx',
  parts: [
    part('voltage_source', '20 V', 20, P(0, 0), P(0, 1), 'from'),
    part('resistor', '20 Ω', 20, P(0, 0), P(1, 0)),
    part('current_source', '4 A', 4, P(1, 1), P(1, 0), 'to'),
    part('resistor', '4 Ω', 4, P(2, 0), P(2, 1)),
    part('dependent_current_source', '0.1vx', 0.1, P(3, 1), P(3, 0), 'to', 'vx'),
  ],
  wires: [{ from: P(1, 0), to: P(3, 0) }, { from: P(0, 1), to: P(3, 1) }],
  ground: [P(2, 1)],
  quantities: [{ name: 'vx', kind: 'node_voltage', at: P(1, 0), part: -1, positive: 'none' }],
  asked: ['vx'],
};
const FIG412 = {
  title: 'Figure 4.12',
  parts: [
    part('voltage_source', '24 V', 24, P(0, 0), P(1, 0), 'from'),
    part('resistor', '8 Ω', 8, P(1, 0), P(2, 0)),
    part('resistor', '4 Ω', 4, P(0, 1), P(1, 1)),
    part('resistor', '4 Ω', 4, P(1, 1), P(2, 1)),
    part('resistor', '3 Ω', 3, P(1, 1), P(1, 2)),
    part('voltage_source', '12 V', 12, P(0, 1), P(0, 2), 'from'),
    part('current_source', '3 A', 3, P(2, 2), P(2, 1), 'to'),
  ],
  wires: [{ from: P(0, 0), to: P(0, 1) }, { from: P(2, 0), to: P(2, 1) }, { from: P(0, 2), to: P(2, 2) }],
  ground: [],
  quantities: [{ name: 'i', kind: 'current_through', at: P(1, 1), part: 4, positive: 'to' }],
  asked: ['i'],
};
const sseEvents = (text) => {
  const ev = [
    { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1500, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  ];
  for (let i = 0; i < text.length; i += 400) ev.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(i, i + 400) } });
  ev.push({ type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 900 } }, { type: 'message_stop' });
  return ev.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
};
const PAGE_OF_TWO = sseEvents(JSON.stringify({ circuits: [FIG1, FIG412], problem: '' }));
const ONE = sseEvents(JSON.stringify({ circuits: [FIG1], problem: 'The 0.1vx label was small; read as 0.1.' }));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

const browser = await chromium.launch();
async function open(init) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, fsTip2: true, tapWireHelp: true })));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(URL0); await page.waitForTimeout(2000);
  await page.evaluate(() => { app.settings.autoStart = false; });
  return { ctx, page, errs };
}
const stage = (page) => page.evaluate(() => app.photo.stage);
async function runAndRead(page, name) {
  await page.evaluate(() => app.editor.setRunning(true));
  await page.waitForTimeout(900);
  return page.evaluate((n) => {
    const e = app.editor.doc.elements.find((x) => x.name === n || (x.constructor.type === 'netlabel' && x.p.name === n));
    return e.constructor.type === 'netlabel' ? app.editor.sim.v(e.nodes[0]) : e.i;
  }, name);
}

// ================================================================== in a browser
{
  const { ctx, page, errs } = await open();
  const bodies = [];
  let reply = PAGE_OF_TWO, status = 200, hold = false;
  await page.route('https://api.anthropic.com/**', async (route) => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    bodies.push({ headers: r.headers(), body: JSON.parse(r.postData() || '{}') });
    if (hold) return; // never answers: the reader cancels
    if (status !== 200) return route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: reply });
  });

  // a picture of a "circuit" made on a canvas: what the file picker hands over
  const png = Buffer.from(await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1600;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 2400, 1600); g.strokeStyle = '#000'; g.lineWidth = 8; g.strokeRect(300, 300, 1800, 1000);
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const choose = async () => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-x=gallery]')]);
    await fc.setFiles({ name: 'circuit.png', mimeType: 'image/png', buffer: png });
  };

  check(await page.isVisible('.ph-banner'), 'Home shows "Circuit from photo"');
  await page.click('.ph-banner'); await page.waitForTimeout(400);
  check(await page.isVisible('.screen.photo.active .ph-btns'), 'the photo page opens with Take a photo / Choose an image');

  // ---- on this phone (the default): no key, no network
  check(await page.isVisible('.ph-mode [data-mode=offline].on') && !(await page.isVisible('.ph-key')), 'reading on the phone is the default, and needs no key');
  const fixture = fs.readFileSync(path.resolve('tests/fixtures/depsource-photo.jpg'));
  {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-x=gallery]')]);
    await fc.setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: fixture });
  }
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 30000 });
  const off = await page.evaluate(() => ({ parts: [...document.querySelectorAll('.ph-parts span')].map((s) => s.textContent).sort(), by: !!document.querySelector('.ph-by'), claude: !!document.querySelector('[data-x=claude]'), warn: document.querySelectorAll('.th-warn').length }));
  check(JSON.stringify(off.parts) === JSON.stringify(['D1 0.1vx', 'I1 4 A', 'R1 4 Ω', 'R2 20 Ω', 'V1 20 V'].sort()) || off.parts.length === 5 && off.parts.includes('D1 0.1vx') && off.parts.includes('V1 20 V'), `read on the phone: ${off.parts.join(', ')}`);
  check(off.by && off.claude && off.warn === 0, 'says it was read on the phone, offers Claude AI, no warnings');
  check(bodies.length === 0, 'nothing was sent anywhere');
  await page.click('[data-x=open]'); await page.waitForTimeout(900);
  const vx = await runAndRead(page, 'vx');
  check(Math.abs(vx - 25) < 1e-6, `Run: vx = ${vx.toFixed(4)} V (read on the phone)`);
  await page.evaluate(() => { app.editor.setRunning(false); app.goHome(); });
  await page.waitForTimeout(400);
  await page.click('.ph-banner'); await page.waitForTimeout(400);
  await page.click('[data-x=again]'); await page.waitForTimeout(200);

  // ---- with Claude AI
  await page.click('.ph-mode [data-mode=claude]'); await page.waitForTimeout(200);
  check(await page.isVisible('.ph-key') && await page.evaluate(() => app.settings.photoReader === 'claude'), 'Claude AI mode shows the key card, and is remembered');
  await page.click('[data-x=camera]'); await page.waitForTimeout(200);
  check(await page.isVisible('.ph-key.need') && (await stage(page)) === 'start', 'without an API key it asks for one first');
  await page.fill('[data-x=key-in]', 'sk-ant-test-1234');
  await page.click('[data-x=key-save]'); await page.waitForTimeout(200);
  check((await page.textContent('.ph-key.ok')).includes('…1234'), 'the key is saved (only its end shown)');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.settings.v1') || '{}').claudeKey === 'sk-ant-test-1234'), 'the key is kept on the device');

  await choose();
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 15000 });
  const sent = bodies.at(-1);
  check(sent.body.model === 'claude-opus-5-5' && sent.body.stream === true, 'the request asks Claude Opus 5.5, streaming');
  const img = sent.body.messages?.[0]?.content?.[0];
  check(img?.type === 'image' && img.source.media_type === 'image/jpeg' && img.source.data.length > 1000, 'the picture goes as a base64 JPEG');
  const dims = await page.evaluate((d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = 'data:image/jpeg;base64,' + d; }), img.source.data);
  check(Math.max(...dims) === 1568 && Math.abs(dims[0] / dims[1] - 1.5) < 0.01, `made smaller to 1568 px on the long side (${dims.join('×')})`);
  check(sent.body.output_config?.format?.type === 'json_schema' && sent.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'structured output, browser access header');
  check(/Bearer sk-ant-test-1234/.test(sent.headers.authorization || '') || sent.headers['x-api-key'] === 'sk-ant-test-1234', 'the key goes with the request');

  check((await page.$$eval('.th-chips [data-c]', (x) => x.length)) === 2, 'a page of two circuits offers both');
  const fig1 = await page.evaluate(() => ({ title: document.querySelector('.ph-title b').textContent, parts: [...document.querySelectorAll('.ph-parts span')].map((s) => s.textContent), fig: document.querySelector('.ph-fig').width, warn: document.querySelectorAll('.th-warn').length }));
  check(fig1.title.startsWith('Fig. 1') && fig1.parts.includes('D1 0.1vx') && fig1.parts.includes('I1 4 A') && fig1.fig > 300 && fig1.warn === 0, `Fig. 1 drawn: ${fig1.parts.join(', ')}`);
  await page.click('.th-chips [data-c="1"]'); await page.waitForTimeout(300);
  const f412 = await page.evaluate(() => ({ title: document.querySelector('.ph-title b').textContent, parts: [...document.querySelectorAll('.ph-parts span')].map((s) => s.textContent), asked: document.querySelector('.ph-asked')?.textContent || '' }));
  check(f412.title === 'Figure 4.12' && f412.parts.includes('R4 3 Ω') && f412.parts.length === 7 && /find i\b/.test(f412.asked), `Figure 4.12 picked: ${f412.parts.join(', ')}`);

  await page.click('[data-x=open]'); await page.waitForTimeout(900);
  check(await page.evaluate(() => app.current === 'editor' && app.editor.doc.name === 'Figure 4.12'), 'Open on the board → the editor, named after the figure');
  check(await page.evaluate(() => !!app.editor.doc.id && app.editor.doc.elements.length > 7), 'a new circuit with its parts');
  const i = await runAndRead(page, 'R4');
  check(Math.abs(i - 2) < 1e-6, `Run: i through the 3 Ω = ${i.toFixed(4)} A (book: 2 A)`);
  await page.evaluate(() => app.editor.setRunning(false));

  // from the editor: ⋮ → Circuit from photo, a 401, then cancelling a slow reply
  await page.click('[data-a=more]'); await page.waitForTimeout(250);
  await page.click('.more-menu [data-m=photo]'); await page.waitForTimeout(400);
  check(await page.evaluate(() => app.current === 'photo' && app.photoFrom === 'editor'), '⋮ → Circuit from photo from the editor');
  check((await stage(page)) === 'result', 'the last reading is still there');
  await page.click('[data-x=again]'); await page.waitForTimeout(200);
  status = 401;
  await choose();
  await page.waitForFunction(() => app.photo.stage === 'error', null, { timeout: 15000 });
  check(await page.isVisible('.ph-empty.bad') && (await page.textContent('.ph-empty.bad')).includes('not accepted'), 'a refused key says so');
  check(await page.isVisible('.ph-key.ok [data-x=key-change]'), '…and offers to change it');
  status = 200; hold = true;
  await page.click('[data-x=again]'); await page.waitForTimeout(200);
  await choose();
  await page.waitForFunction(() => app.photo.stage === 'reading', null, { timeout: 5000 });
  check(await page.isVisible('.ph-shot.reading img'), 'reading shows the picture');
  await page.click('[data-x=cancel]'); await page.waitForTimeout(300);
  check((await stage(page)) === 'start', 'Cancel goes back to the start');
  hold = false; reply = ONE;
  await choose();
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 15000 });
  check((await page.textContent('.ph-note')).includes('0.1vx label was small'), 'Claude\'s doubts are shown');
  check(!(await page.isVisible('.th-chips [data-c]')), 'one circuit: no chooser');
  await page.evaluate(() => app.back()); await page.waitForTimeout(200);
  check((await stage(page)) === 'start', 'Back: result → start');
  await page.evaluate(() => app.back()); await page.waitForTimeout(300);
  check(await page.evaluate(() => app.current === 'editor' && app.editor.doc.name === 'Figure 4.12'), 'Back again: the circuit being edited');
  check(await page.evaluate(() => !JSON.stringify(localStorage.getItem('raptickt.circuits.v1') || '').includes('sk-ant')), 'the key is not in the saved circuits');
  check(errs.length === 0, `no page errors (${errs.join(' | ')})`);
  await ctx.close();
}

// ================================================================== as in the Android app
{
  const fake = ({ sse, jpeg }) => {
    const calls = (window.__nativeCalls = []);
    const later = (f, ms = 30) => setTimeout(f, ms);
    window.RaptiAndroid = {
      appVersion: () => 'Android test', deviceInfo: () => '{}', vibrate() {}, openUrl() {}, shareText() {}, saveFile() {}, openFile() {},
      setImmersive() {}, setOrientation() {}, keepScreenOn() {},
      pickImage(camera, max) { calls.push(['pickImage', camera, max]); later(() => window.__raptiImage(jpeg)); },
      httpAbort(id) { calls.push(['httpAbort', id]); },
      httpRequest(id, method, url, headers, body) {
        calls.push(['httpRequest', id, method, url, JSON.parse(headers), JSON.parse(body)]);
        later(() => {
          window.__raptiHttpHead(id, 200, JSON.stringify([['content-type', 'text/event-stream'], ['request-id', 'req_1']]));
          // the answer arrives in pieces, cut anywhere (even inside a UTF-8 character)
          const bytes = new TextEncoder().encode(sse);
          let at = 0;
          const next = () => {
            if (at >= bytes.length) { window.__raptiHttpEnd(id); return; }
            const piece = bytes.slice(at, at + 777); at += 777;
            let s = ''; for (const b of piece) s += String.fromCharCode(b);
            window.__raptiHttpData(id, btoa(s));
            later(next, 5);
          };
          next();
        });
      },
    };
  };
  const { ctx, page, errs } = await open({ fn: fake, arg: { sse: ONE, jpeg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==' } });
  let pageFetch = 0;
  await page.route('https://api.anthropic.com/**', (route) => { pageFetch++; return route.abort(); });
  await page.evaluate(() => { app.settings.claudeKey = 'sk-ant-native-9999'; app.saveSettings(); app.newCircuit(); });
  await page.waitForTimeout(700);
  check(await page.isVisible('.hint .hint-photo'), 'an empty board offers "Or start from a photo"');
  await page.click('.hint .hint-photo'); await page.waitForTimeout(400);
  await page.click('[data-x=camera]');
  // read on the phone first: a 1-pixel picture holds no circuit, so it says so and offers Claude
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 15000 });
  check(await page.isVisible('.ph-empty') && await page.isVisible('[data-x=claude]'), 'no circuit read on the phone: it says so and offers Claude AI');
  let calls = await page.evaluate(() => window.__nativeCalls);
  check(calls[0][0] === 'pickImage' && calls[0][1] === true && calls[0][2] === 2600, 'Take a photo asks the app for the camera, in more detail for reading on the phone');
  check(!calls.some((c) => c[0] === 'httpRequest'), 'reading on the phone sends nothing');
  await page.click('[data-x=claude]');
  await page.waitForFunction(() => app.photo.stage === 'result' && app.photo.answer?.by === 'claude', null, { timeout: 15000 });
  calls = await page.evaluate(() => window.__nativeCalls);
  const req = calls.find((c) => c[0] === 'httpRequest');
  check(!!req && req[2] === 'POST' && /^https:\/\/api\.anthropic\.com\/v1\/messages/.test(req[3]), 'the request goes through the app (POST /v1/messages)');
  check(req && req[5].model === 'claude-opus-5-5' && req[5].messages[0].content[0].source.data.startsWith('/9j/'), 'with the camera picture');
  check(req && (req[4].authorization === 'Bearer sk-ant-native-9999' || req[4]['x-api-key'] === 'sk-ant-native-9999'), 'and the key');
  check(pageFetch === 0, 'the page itself fetches nothing');
  check((await page.textContent('.ph-title b')).startsWith('Fig. 1'), 'the streamed answer is read');
  await page.click('[data-x=open]'); await page.waitForTimeout(900);
  const vx = await runAndRead(page, 'vx');
  check(Math.abs(vx - 25) < 1e-6, `Run: vx = ${vx.toFixed(4)} V (book: 25 V)`);
  check(await page.evaluate(() => app.editor.doc.elements.some((e) => e.constructor.type === 'depsrc' && e.p.ctrl === 'node:vx')), 'the 0.1vx diamond is controlled by vx');
  check(errs.length === 0, `no page errors (${errs.join(' | ')})`);
  await ctx.close();
}

await browser.close(); server.close();
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
