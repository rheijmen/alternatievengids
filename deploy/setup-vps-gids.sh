#!/usr/bin/env bash
# alternatievengids.nl op de VPS waar ook de Soevereiniteitsscan op draait (Caddy).
#
# Wat het doet:
#   - maakt een leessleutel (deploy key) voor GitHub, zodat de VPS de private repo mag lezen
#   - haalt de kant-en-klare site op (branch "site", die GitHub elke ochtend en bij elke wijziging bouwt)
#   - werkt de site elke 5 minuten bij, net als de scan
#   - voegt de site toe aan Caddy via een eigen bestand (/etc/caddy/conf.d/alternatievengids.caddy)
#     en een import-regel onderaan de Caddyfile. Daarna test het de configuratie en zet bij een fout alles terug.
#
# Raakt de scan niet aan. Voer als root uit, bijvoorbeeld in de Hostinger Webconsole, nadat setup-vps.sh van de scan
# ooit is gedraaid (Caddy en git staan dan al). Veilig om opnieuw te draaien.
#
# LET OP: draait de scan later setup-vps.sh opnieuw, dan schrijft dat de Caddyfile opnieuw en verdwijnt de
# import-regel. Draai dan dit script nog eens (30 seconden), of laat setup-vps.sh die regel behouden (zie docs/HOSTING.md).

set -euo pipefail

REPO="${REPO:-git@github.com:rheijmen/alternatievengids.git}"
BRANCH="${BRANCH:-site}"
DOMAIN="${DOMAIN:-alternatievengids.nl}"
DIR="${DIR:-/var/www/alternatievengids}"
KEY="${KEY:-/etc/alternatievengids/deploy_key}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
CONF_DIR="${CONF_DIR:-/etc/caddy/conf.d}"
CADDY="${CADDY:-caddy}"
SITE_CONF="$CONF_DIR/alternatievengids.caddy"

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nGestopt: %s\n' "$*" >&2; exit 1; }

git_ssh() {
  echo "ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$(dirname "$KEY")/known_hosts"
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

install_updater() {
  cat > /usr/local/bin/alternatievengids-update <<EOF2
#!/usr/bin/env bash
set -euo pipefail
export GIT_SSH_COMMAND="$(git_ssh)"
git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
git -C "$DIR" reset -q --hard FETCH_HEAD
EOF2
  chmod 755 /usr/local/bin/alternatievengids-update
  cat > /etc/systemd/system/alternatievengids-update.service <<'EOF2'
[Unit]
Description=Pull the latest alternatievengids.nl site from GitHub
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/alternatievengids-update
EOF2
  cat > /etc/systemd/system/alternatievengids-update.timer <<'EOF2'
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
  [ "$(id -u)" -eq 0 ] || die "voer dit uit als root."
  grep -q 'Ubuntu' /etc/os-release || die "dit script is geschreven voor Ubuntu."
  command -v "$CADDY" >/dev/null || die "Caddy ontbreekt. Draai eerst setup-vps.sh van de scan."
  command -v git >/dev/null || die "git ontbreekt. Draai eerst setup-vps.sh van de scan."
  [ -f "$CADDYFILE" ] || die "$CADDYFILE bestaat niet. Draai eerst setup-vps.sh van de scan."
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "dat lijkt geen geldige domeinnaam."

  say "Leessleutel voor GitHub"
  ensure_key
  cat <<EOF2

Zet deze sleutel in GitHub, anders mag de VPS de private repo niet lezen:
  1. Ga naar https://github.com/rheijmen/alternatievengids/settings/keys
  2. Klik op "Add deploy key". Titel: VPS. Plak de regel hieronder in het grote veld.
  3. Laat "Allow write access" UIT staan. Klik op "Add key".

$(cat "$KEY.pub")

EOF2
  read -rp "Gelukt? Druk op Enter om door te gaan: " _ </dev/tty

  say "Site ophalen van GitHub (branch $BRANCH)"
  export GIT_SSH_COMMAND="$(git_ssh)"
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" fetch -q --depth 1 origin "$BRANCH" && git -C "$DIR" reset -q --hard FETCH_HEAD
  else
    rm -rf "$DIR"
    git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$DIR" || die "ophalen mislukt. Staat de sleutel in GitHub, en bestaat de branch '$BRANCH'? Die maakt GitHub aan na het mergen van de wijziging en de eerste bouw (tabblad Actions)."
  fi
  [ -f "$DIR/index.html" ] || die "er staat geen index.html in $DIR. Is de eerste bouw op GitHub klaar?"
  chmod 755 "$DIR"

  say "Automatisch bijwerken elke 5 minuten"
  install_updater

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
