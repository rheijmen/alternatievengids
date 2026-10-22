#!/usr/bin/env bash
# alternatievengids.nl op de VPS waar ook de Soevereiniteitsscan op draait (Caddy).
#
# Eén regel in de Webconsole van de VPS (als root):
#   curl -fsSL https://raw.githubusercontent.com/rheijmen/alternatievengids/main/deploy/setup-vps-gids.sh | bash
#
# Het script stelt geen vragen. Wat het doet:
#   - haalt de kant-en-klare site op (branch "site", die GitHub elke ochtend en bij elke wijziging bouwt)
#   - werkt de site elke 5 minuten bij, net als de scan
#   - voegt de site toe aan Caddy via een eigen bestand (/etc/caddy/conf.d/alternatievengids.caddy)
#     en een import-regel onderaan de Caddyfile. Daarna test het de configuratie en zet bij een fout alles terug.
#
# Raakt de scan niet aan. Veilig om opnieuw te draaien. Vereist dat setup-vps.sh van de scan ooit is gedraaid
# (Caddy en git staan dan al) en dat de repo openbaar is. Blijft de repo privé: USE_KEY=1 bash setup-vps-gids.sh
# maakt een leessleutel die je in GitHub als deploy key moet zetten.
#
# LET OP: draait de scan later setup-vps.sh opnieuw, dan schrijft dat de Caddyfile opnieuw en verdwijnt de
# import-regel. Draai dan deze regel nog eens (30 seconden), of laat setup-vps.sh die regel behouden (zie docs/HOSTING.md).

set -euo pipefail

USE_KEY="${USE_KEY:-}"
REPO="${REPO:-}"
BRANCH="${BRANCH:-site}"
DOMAIN="${DOMAIN:-alternatievengids.nl}"
DIR="${DIR:-/var/www/alternatievengids}"
KEY="${KEY:-/etc/alternatievengids/deploy_key}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
CONF_DIR="${CONF_DIR:-/etc/caddy/conf.d}"
CADDY="${CADDY:-caddy}"
SITE_CONF="$CONF_DIR/alternatievengids.caddy"
# Overridable for the tests; on a real server the defaults are right.
BIN_DIR="${BIN_DIR:-/usr/local/bin}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
OS_RELEASE="${OS_RELEASE:-/etc/os-release}"
if [ -z "$REPO" ]; then
  if [ -n "$USE_KEY" ]; then REPO="git@github.com:rheijmen/alternatievengids.git"; else REPO="https://github.com/rheijmen/alternatievengids.git"; fi
fi

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nGestopt: %s\n' "$*" >&2; exit 1; }

git_ssh() {
  echo "ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$(dirname "$KEY")/known_hosts"
}

# Line for the update script: only with a key (private repo); a public repo needs nothing.
updater_env() {
  [ -n "$USE_KEY" ] && printf 'export GIT_SSH_COMMAND="%s"\n' "$(git_ssh)" || true
}

ensure_key() {
  install -d -m 700 "$(dirname "$KEY")"
  [ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N '' -C "alternatievengids-vps" -f "$KEY"
}

# One import line at the bottom of the Caddyfile, added once.
ensure_import() {
  local line="import $CONF_DIR/*.caddy"
  mkdir -p "$CONF_DIR"
  chmod 755 "$CONF_DIR"
  if ! grep -qxF "$line" "$CADDYFILE"; then
    printf '\n# Extra sites (deploy/setup-vps-gids.sh). setup-vps.sh van de scan moet deze regel behouden.\n%s\n' "$line" >> "$CADDYFILE"
  fi
}

write_site_conf() {
  mkdir -p "$CONF_DIR"
  cat > "$SITE_CONF" <<CONF
# Beheerd door deploy/setup-vps-gids.sh.
www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}

$DOMAIN {
	root * $DIR
	encode zstd gzip

	# Bestanden die niet bij de site horen.
	@hidden path /.git /.git/* /build.json /.htaccess
	respond @hidden 404

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		-Server
	}
	# css, js en lettertypen hebben een versie in de pagina (?v=hash): lang bewaren is veilig.
	@versioned path /css/* /js/* /assets/fonts/*
	header @versioned Cache-Control "public, max-age=31536000, immutable"
	@fresh not path /css/* /js/* /assets/fonts/*
	header @fresh Cache-Control "no-cache"

	file_server
	handle_errors {
		rewrite * /404.html
		file_server
	}
}
CONF
  chmod 644 "$SITE_CONF"
}

# Adds the site, tests the whole configuration, and puts everything back when Caddy refuses it.
apply_caddy() {
  local backup="$CADDYFILE.bak-alternatievengids" out
  cp -p "$CADDYFILE" "$backup"
  ensure_import
  write_site_conf
  if out="$("$CADDY" validate --config "$CADDYFILE" --adapter caddyfile 2>&1)"; then
    systemctl reload caddy 2>/dev/null || systemctl restart caddy
  else
    cp -p "$backup" "$CADDYFILE"
    rm -f "$SITE_CONF"
    printf '%s\n' "$out" >&2
    die "Caddy keurde de configuratie af. Alles is teruggezet zoals het was; de scan is niet geraakt."
  fi
}

# Keeps a copy of this script on the server, so it can be run again later (for example with USE_KEY=1 when the repo
# goes private, and the raw GitHub address no longer works without a login).
save_self() {
  local target="$BIN_DIR/alternatievengids-setup" tmp
  tmp="$(mktemp)"
  if [ -f "${BASH_SOURCE[0]:-}" ]; then cp "${BASH_SOURCE[0]}" "$tmp"
  else curl -fsSL "${SELF_URL:-https://raw.githubusercontent.com/rheijmen/alternatievengids/main/deploy/setup-vps-gids.sh}" -o "$tmp" 2>/dev/null || true; fi
  if head -1 "$tmp" 2>/dev/null | grep -q '^#!/usr/bin/env bash'; then install -m 755 "$tmp" "$target"; fi
  rm -f "$tmp"
}

install_updater() {
  cat > "$BIN_DIR/alternatievengids-update" <<EOF2
#!/usr/bin/env bash
set -euo pipefail
$(updater_env)
before="\$(git -C "$DIR" rev-parse HEAD)"
git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
git -C "$DIR" reset -q --hard FETCH_HEAD
# Only when something changed: throw away old versions of the site so the disk does not fill up.
if [ "\$before" != "\$(git -C "$DIR" rev-parse HEAD)" ]; then
  git -C "$DIR" reflog expire --expire=now --all
  git -C "$DIR" gc -q --prune=now || true
fi
EOF2
  chmod 755 "$BIN_DIR/alternatievengids-update"
  cat > "$UNIT_DIR/alternatievengids-update.service" <<EOF2
[Unit]
Description=Pull the latest alternatievengids.nl site from GitHub
After=network-online.target

[Service]
Type=oneshot
ExecStart=$BIN_DIR/alternatievengids-update
EOF2
  cat > "$UNIT_DIR/alternatievengids-update.timer" <<'EOF2'
[Unit]
Description=Pull the latest alternatievengids.nl site every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF2
  systemctl daemon-reload
  systemctl enable --now alternatievengids-update.timer >/dev/null
}

main() {
  [ "$(id -u)" -eq 0 ] || [ -n "${ALLOW_NON_ROOT:-}" ] || die "voer dit uit als root."
  grep -q 'Ubuntu' "$OS_RELEASE" || die "dit script is geschreven voor Ubuntu."
  command -v "$CADDY" >/dev/null || die "Caddy ontbreekt. Draai eerst setup-vps.sh van de scan."
  command -v git >/dev/null || die "git ontbreekt. Draai eerst setup-vps.sh van de scan."
  [ -f "$CADDYFILE" ] || die "$CADDYFILE bestaat niet. Draai eerst setup-vps.sh van de scan."
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "dat lijkt geen geldige domeinnaam."

  if [ -n "$USE_KEY" ]; then
    say "Leessleutel voor GitHub (privé-repo)"
    ensure_key
    cat <<EOF2

Zet deze sleutel in GitHub, anders mag de VPS de private repo niet lezen:
  1. Ga naar https://github.com/rheijmen/alternatievengids/settings/keys
  2. Klik op "Add deploy key". Titel: VPS. Plak de regel hieronder in het grote veld.
  3. Laat "Allow write access" UIT staan. Klik op "Add key".

$(cat "$KEY.pub")

EOF2
    read -rp "Gelukt? Druk op Enter om door te gaan: " _ </dev/tty
    export GIT_SSH_COMMAND="$(git_ssh)"
  fi

  say "Site ophalen van GitHub (branch $BRANCH)"
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" remote set-url origin "$REPO"
    git -C "$DIR" fetch -q --depth 1 origin "$BRANCH" && git -C "$DIR" reset -q --hard FETCH_HEAD
  else
    rm -rf "$DIR"
    git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR" || die "ophalen mislukt. Is de repo openbaar, en bestaat de branch '$BRANCH'? Die maakt GitHub aan na de eerste bouw op main (tabblad Actions)."
  fi
  [ -f "$DIR/index.html" ] || die "er staat geen index.html in $DIR. Is de eerste bouw op GitHub klaar?"
  chmod 755 "$DIR"

  say "Automatisch bijwerken elke 5 minuten"
  install_updater
  save_self

  say "Webserver (Caddy)"
  apply_caddy

  local ip
  ip="$(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
  say "Klaar"
  cat <<EOF2
De site wordt geleverd voor https://$DOMAIN zodra het domein naar deze server wijst.

Zet in hPanel bij Domeinen, DNS-records van $DOMAIN:
  A     @     $ip
  A     www   $ip
(Haal bestaande A-, AAAA- en CNAME-records voor @ en www weg, zodat er niets tegenspreekt.)
Caddy haalt het HTTPS-certificaat automatisch op zodra dat werkt. Dat kan een paar minuten duren.

Bijwerken gebeurt vanzelf elke 5 minuten. Direct bijwerken: alternatievengids-update
EOF2
}

# GIDS_SOURCE_ONLY=1 laadt alleen de functies (voor de tests); anders loopt het script gewoon, ook als het via een pipe binnenkomt.
[ -n "${GIDS_SOURCE_ONLY:-}" ] || main "$@"
