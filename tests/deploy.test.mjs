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

// ---- The whole script, end to end, against a local copy of the repo ------------------------------------------

const sh = (cmd, opts = {}) => spawnSync('bash', ['-c', cmd], { encoding: 'utf8', ...opts });

async function fullRun(extraEnv = {}) {
  const s = await sandbox(0);
  const bare = path.join(s.dir, 'remote.git'), work = path.join(s.dir, 'work');
  const git = `git -c user.name=t -c user.email=t@t`;
  assert.equal(sh(`git init -q --bare -b site "${bare}" && git init -q -b site "${work}" && cd "${work}" && echo "<h1>versie 1</h1>" > index.html && ${git} add -A && ${git} commit -q -m v1 && git push -q "${bare}" site`).status, 0);
  await fs.writeFile(path.join(s.dir, 'os-release'), 'NAME="Ubuntu"\n');
  await fs.writeFile(path.join(s.dir, 'bin', 'curl'), '#!/usr/bin/env bash\necho 203.0.113.7\n', { mode: 0o755 });
  const units = path.join(s.dir, 'units'), bins = path.join(s.dir, 'localbin');
  await fs.mkdir(units); await fs.mkdir(bins);
  const env = { ...process.env, PATH: `${path.join(s.dir, 'bin')}:${process.env.PATH}`, CADDYFILE: s.caddyfile, CONF_DIR: path.join(s.dir, 'conf.d'), DIR: path.join(s.dir, 'www'),
    FAKE_LOG: s.log, REPO: bare, BIN_DIR: bins, UNIT_DIR: units, OS_RELEASE: path.join(s.dir, 'os-release'), ALLOW_NON_ROOT: '1', ...extraEnv };
  const run = () => spawnSync('bash', [script], { env, encoding: 'utf8', input: '' });
  return { ...s, bare, work, units, bins, env, run, git };
}

test('hele script: haalt de site op, zet bijwerken en Caddy aan, vraagt niets, en is herhaalbaar', async () => {
  const s = await fullRun();
  const r = s.run();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(await fs.readFile(path.join(s.dir, 'www', 'index.html'), 'utf8'), '<h1>versie 1</h1>\n');
  assert.match(r.stdout, /A\s+@\s+203\.0\.113\.7/);
  assert.match(r.stdout, /A\s+www\s+203\.0\.113\.7/);
  const updater = await fs.readFile(path.join(s.bins, 'alternatievengids-update'), 'utf8');
  assert.ok(!/GIT_SSH_COMMAND/.test(updater), 'een openbare repo heeft geen sleutel nodig');
  assert.match(await fs.readFile(path.join(s.units, 'alternatievengids-update.service'), 'utf8'), new RegExp(`ExecStart=${s.bins}/alternatievengids-update`));
  assert.match(await fs.readFile(path.join(s.units, 'alternatievengids-update.timer'), 'utf8'), /OnUnitActiveSec=5min/);
  assert.match(await fs.readFile(s.caddyfile, 'utf8'), /import .*conf\.d/);
  // second run changes nothing
  const caddyAfterFirst = await fs.readFile(s.caddyfile, 'utf8');
  assert.equal(s.run().status, 0);
  assert.equal(await fs.readFile(s.caddyfile, 'utf8'), caddyAfterFirst);
  // a new build on the site branch arrives through the update script
  assert.equal(sh(`cd "${s.work}" && echo "<h1>versie 2</h1>" > index.html && ${s.git} commit -qam v2 && git push -q "${s.bare}" site`).status, 0);
  const up = spawnSync(path.join(s.bins, 'alternatievengids-update'), { env: s.env, encoding: 'utf8' });
  assert.equal(up.status, 0, up.stderr);
  assert.equal(await fs.readFile(path.join(s.dir, 'www', 'index.html'), 'utf8'), '<h1>versie 2</h1>\n');
});

test('hele script: zonder site-branch of met een kapotte Caddy stopt het met een duidelijke melding', async () => {
  const s = await fullRun({ REPO: '/does/not/exist.git' });
  const r = s.run();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ophalen mislukt/);
  assert.equal((await fs.readFile(s.caddyfile, 'utf8')).includes('import '), false, 'de Caddyfile is niet aangeraakt');
});

test('privé-modus (USE_KEY): ssh-adres en sleutel in het bijwerkscript', async () => {
  const s = await sandbox(0);
  const r = spawnSync('bash', ['-c', `set -euo pipefail; source "${script}"; echo "$REPO"; updater_env`], { env: { ...process.env, GIDS_SOURCE_ONLY: '1', USE_KEY: '1', KEY: path.join(s.dir, 'k', 'deploy_key') }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^git@github\.com:rheijmen\/alternatievengids\.git/m);
  assert.match(r.stdout, /export GIT_SSH_COMMAND="ssh -i .*deploy_key/);
  const pub = spawnSync('bash', ['-c', `set -euo pipefail; source "${script}"; echo "$REPO"`], { env: { ...process.env, GIDS_SOURCE_ONLY: '1' }, encoding: 'utf8' });
  assert.match(pub.stdout.trim(), /^https:\/\/github\.com\/rheijmen\/alternatievengids\.git$/);
});

test('hele script via een pipe (curl ... | bash), zoals het op de VPS wordt gebruikt', async () => {
  const s = await fullRun();
  const r = spawnSync('bash', ['-c', `cat "${script}" | bash`], { env: s.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(await fs.readFile(path.join(s.dir, 'www', 'index.html'), 'utf8'), '<h1>versie 1</h1>\n');
  assert.match(r.stdout, /Klaar/);
});
