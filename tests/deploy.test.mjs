import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

// The VPS script is only tested with fake paths and a fake caddy/systemctl: nothing touches a real server.
const script = path.resolve('deploy/setup-vps-gids.sh');

async function sandbox(caddyExit) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vps-'));
  const bin = path.join(dir, 'bin');
  await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'caddy'), `#!/usr/bin/env bash\n${caddyExit === 0 ? 'exit 0' : 'echo "Error: fake validation error" >&2; exit 1'}\n`, { mode: 0o755 });
  await fs.writeFile(path.join(bin, 'systemctl'), '#!/usr/bin/env bash\necho "$@" >> "$FAKE_LOG"\n', { mode: 0o755 });
  const caddyfile = path.join(dir, 'Caddyfile');
  await fs.writeFile(caddyfile, 'scan.newground.nl {\n\troot * /var/www/sovereignos\n}\n');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GIDS_SOURCE_ONLY: '1', CADDYFILE: caddyfile, CONF_DIR: path.join(dir, 'conf.d'), DIR: path.join(dir, 'www'), FAKE_LOG: path.join(dir, 'log'), DOMAIN: 'alternatievengids.nl' };
  const run = cmd => spawnSync('bash', ['-c', `set -euo pipefail; source "${script}"; ${cmd}`], { env, encoding: 'utf8' });
  return { dir, caddyfile, conf: path.join(dir, 'conf.d', 'alternatievengids.caddy'), run, log: path.join(dir, 'log') };
}

test('de scripts zijn geldige bash', () => {
  assert.equal(spawnSync('bash', ['-n', script]).status, 0);
});

test('import-regel komt precies een keer onderaan de Caddyfile', async () => {
  const s = await sandbox(0);
  assert.equal(s.run('ensure_import; ensure_import; ensure_import').status, 0);
  const text = await fs.readFile(s.caddyfile, 'utf8');
  assert.equal(text.split('\n').filter(l => l.startsWith('import ')).length, 1);
  assert.ok(text.startsWith('scan.newground.nl {'), 'de bestaande site van de scan blijft ongemoeid');
  assert.match(text, /import .*\/conf\.d\/\*\.caddy\n$/);
});

test('siteconfig: apex met bestandsserver, www doorverwezen, niet-site-bestanden verborgen, geen noindex', async () => {
  const s = await sandbox(0);
  assert.equal(s.run('write_site_conf').status, 0);
  const c = await fs.readFile(s.conf, 'utf8');
  assert.match(c, /www\.alternatievengids\.nl \{\n\tredir https:\/\/alternatievengids\.nl\{uri\} permanent/);
  assert.match(c, /^alternatievengids\.nl \{/m);
  assert.match(c, /root \* .*\/www/);
  assert.match(c, /@hidden path \/\.git \/\.git\/\* \/build\.json \/\.htaccess/);
  assert.match(c, /handle_errors \{\n\t\trewrite \* \/404\.html/);
  assert.ok(!/X-Robots-Tag|noindex/i.test(c), 'de Gids moet geindexeerd mogen worden');
});

test('goedgekeurde configuratie: Caddy wordt herladen en de site staat erin', async () => {
  const s = await sandbox(0);
  const r = s.run('apply_caddy');
  assert.equal(r.status, 0, r.stderr);
  assert.match(await fs.readFile(s.caddyfile, 'utf8'), /import .*conf\.d/);
  await fs.access(s.conf);
  assert.match(await fs.readFile(s.log, 'utf8'), /reload caddy/);
});

test('afgekeurde configuratie: alles terug zoals het was, scan ongemoeid', async () => {
  const s = await sandbox(1);
  const before = await fs.readFile(s.caddyfile, 'utf8');
  const r = s.run('apply_caddy');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /fake validation error/);
  assert.match(r.stderr, /scan is niet geraakt/);
  assert.equal(await fs.readFile(s.caddyfile, 'utf8'), before, 'Caddyfile is teruggezet');
  await assert.rejects(fs.access(s.conf), 'de siteconfig is weggehaald');
  await assert.rejects(fs.readFile(s.log, 'utf8'), 'Caddy is niet herladen met een kapotte config');
});
