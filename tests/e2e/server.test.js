// End-to-end tests for the dev server (`npm start`, tools/serve.mjs): it is started as a real child process on a free port
// and spoken to over real HTTP.
//   - The repository's own server checks the happy paths: the page, module MIME types and a 404.
//   - A throwaway copy of the script in a scratch site (<tmp>/site, next to <tmp>/site-secret) checks that nothing outside
//     the site root can be fetched, however the path is written.
//   - The traversal guard itself (`isInsideRoot`) is checked directly, including the sibling directory whose name only
//     *starts with* the root's name. (Over HTTP that case cannot be reached: the request path always starts with `/`, and
//     `path.normalize` folds every leading `..` away before the guard runs. The guard is defence in depth.)
// The children are always killed in after().
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInsideRoot } from '../../tools/serve.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SERVE = join(REPO, 'tools/serve.mjs');
const SECRET = 'TOP-SECRET-OUTSIDE-THE-SITE';

/** A port nothing is listening on right now. */
function freePort() {
  return new Promise((ok, fail) => {
    const probe = net.createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => ok(port));
    });
  });
}

const children = []; // every server started, so after() can kill them even if another one failed to start

/** Start `script` as a child process with PORT set; resolves once it prints that it is listening. */
async function startServer(script) {
  const port = await freePort();
  const child = spawn(process.execPath, [script], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  const exited = new Promise((_, fail) => child.once('exit', (code) => fail(new Error(`server exited early (code ${code})`))));
  const listening = new Promise((ok) => {
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes(`http://localhost:${port}`)) ok();
    });
  });
  const timeout = new Promise((_, fail) => setTimeout(() => fail(new Error('server did not start within 10 s')), 10_000).unref());
  try {
    await Promise.race([listening, exited, timeout]);
  } catch (e) {
    child.kill();
    throw e;
  }
  child.removeAllListeners('exit');
  return { child, port };
}

/**
 * GET `path` exactly as written (fetch() would tidy `..` away before sending, which is the opposite of what a traversal
 * test wants). Resolves { status, type, body }.
 */
function get(port, path) {
  return new Promise((ok, fail) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => ok({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.once('error', fail);
    req.end();
  });
}

let repoServer;
let siteServer;
let scratch;

before(async () => {
  // <scratch>/site holds a copy of the server (so its root is the site) and a page; <scratch>/site-secret is its neighbour
  scratch = mkdtempSync(join(tmpdir(), 'epoch-strike-serve-'));
  const site = join(scratch, 'site');
  mkdirSync(join(site, 'tools'), { recursive: true });
  mkdirSync(join(scratch, 'site-secret'));
  copyFileSync(SERVE, join(site, 'tools/serve.mjs'));
  writeFileSync(join(site, 'index.html'), '<title>scratch site</title>');
  writeFileSync(join(scratch, 'site-secret/secret.txt'), SECRET);
  writeFileSync(join(scratch, 'outside.txt'), SECRET);
  [repoServer, siteServer] = await Promise.all([startServer(SERVE), startServer(join(site, 'tools/serve.mjs'))]);
});

after(() => {
  for (const child of children) child.kill();
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

test('GET / serves index.html as HTML', async () => {
  const res = await get(repoServer.port, '/');
  assert.equal(res.status, 200);
  assert.match(res.type, /^text\/html/);
  assert.equal(res.body, readFileSync(join(REPO, 'index.html'), 'utf8'));
});

test('JavaScript modules are served as text/javascript, CSS as text/css', async () => {
  const js = await get(repoServer.port, '/src/main.js');
  assert.equal(js.status, 200);
  assert.match(js.type, /^text\/javascript/);
  assert.match(js.body, /import/);
  const css = await get(repoServer.port, '/style.css');
  assert.equal(css.status, 200);
  assert.match(css.type, /^text\/css/);
});

test('a missing file is a 404, and so is a directory without an index.html', async () => {
  assert.equal((await get(repoServer.port, '/src/does-not-exist.js')).status, 404);
  assert.equal((await get(repoServer.port, '/src/engine')).status, 404, 'a directory is not a file');
});

test('dot-dot segments cannot reach files outside the site root', async () => {
  // the URL parser folds `/../` to `/`, so this stays inside the root and finds nothing there
  const plain = await get(siteServer.port, '/../outside.txt');
  assert.notEqual(plain.status, 200);
  assert.ok(!plain.body.includes(SECRET));
});

test('percent-encoded traversal never serves a file outside the site root', async () => {
  const attempts = ['/..%2foutside.txt', '/%2e%2e%2foutside.txt', '/..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpasswd', '/src/..%2f..%2foutside.txt', '/..%2fsite-secret%2fsecret.txt', '/%2e%2e%2fsite-secret%2fsecret.txt'];
  for (const path of attempts) {
    const res = await get(siteServer.port, path);
    assert.ok(res.status === 403 || res.status === 404, `${path} is refused (got ${res.status})`);
    assert.ok(!res.body.includes(SECRET) && !res.body.includes('root:'), `${path} leaks nothing`);
  }
  const real = await get(repoServer.port, '/..%2f..%2f..%2fetc%2fpasswd');
  assert.ok(real.status === 403 || real.status === 404, 'the same on the real server');
  assert.ok(!real.body.includes('root:'));
  // and the site's own files still work, so the server is not simply refusing everything
  const home = await get(siteServer.port, '/');
  assert.equal(home.status, 200);
  assert.match(home.body, /scratch site/);
});

test('the traversal guard: the root and everything below it is inside; parents and look-alike siblings are not', () => {
  const root = '/srv/site';
  assert.equal(isInsideRoot(root, '/srv/site'), true, 'the root itself');
  assert.equal(isInsideRoot(root, '/srv/site/index.html'), true);
  assert.equal(isInsideRoot(root, '/srv/site/src/deep/file.js'), true);
  assert.equal(isInsideRoot(root, '/srv/site-secret/secret.txt'), false, 'sibling whose name starts with the root name');
  assert.equal(isInsideRoot(root, '/srv/site2'), false);
  assert.equal(isInsideRoot(root, '/srv/sitemap.txt'), false);
  assert.equal(isInsideRoot(root, '/srv'), false, 'the parent');
  assert.equal(isInsideRoot(root, '/etc/passwd'), false);
  assert.equal(isInsideRoot('/', '/anything'), true, 'a filesystem-root site contains everything');
});
