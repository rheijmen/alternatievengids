# alternatievengids.nl online zetten

Gekozen (22 oktober): op de VPS waar ook de scan draait, met het domein bij Hostinger. De site is statisch: een map met bestanden, geen database en geen WordPress. Bouwen doet GitHub; de VPS haalt de kant-en-klare site op. Menunamen in hPanel kunnen iets afwijken.

```
GitHub bouwt (bij elke wijziging en elke ochtend)  ->  branch "site"  ->  VPS haalt elke 5 minuten op  ->  Caddy
```

## Eerst nalopen

1. Teksten die over jou en Newground gaan: `/hoe-we-beoordelen/`, `/over/`, `/sponsor/` (zie `docs/OVERDRACHT.md`).
2. Simple Analytics: voeg alternatievengids.nl toe als website in je account, anders telt het niets.
3. De wijziging met `deploy/setup-vps-gids.sh` en de publicatie naar de branch `site` is gemerged. Daarna bouwt GitHub de branch `site` vanzelf (tabblad Actions, "Bouwen en controleren", controleer dat de taak "publish" groen is).

## Stap 1: het script op de VPS zetten en draaien

1. Open `deploy/setup-vps-gids.sh` op GitHub (repo `rheijmen/alternatievengids`) en klik op het icoon "Copy raw file".
2. Open de Webconsole van je VPS in hPanel (als root). Typ `nano /root/setup-gids.sh`, plak de tekst, sla op (Ctrl+O, Enter, Ctrl+X).
3. Draai `bash /root/setup-gids.sh`.
4. Het script toont een sleutel. Zet die in GitHub: repo, Settings, Deploy keys, Add deploy key, titel "VPS", plak de regel, laat "Allow write access" UIT. Terug in de console op Enter drukken.
5. Het script haalt de site op, zet het bijwerken elke 5 minuten aan en voegt de site aan Caddy toe. Caddy wordt eerst getest; keurt hij de configuratie af, dan zet het script alles terug en blijft de scan ongemoeid.
6. Aan het eind staat het IP-adres van de server en welke DNS-records je moet zetten.

## Stap 2: DNS bij Hostinger

hPanel, Domeinen, alternatievengids.nl, DNS-records:

- A-record `@` naar het IP-adres van de VPS.
- A-record `www` naar hetzelfde IP-adres.
- Haal bestaande A-, AAAA- en CNAME-records voor `@` en `www` weg (bijvoorbeeld een parkeerpagina), zodat er niets tegenspreekt.
- Voeg dit domein NIET toe als website bij een webhostingpakket: dan wijst het naar Hostinger in plaats van naar de VPS.

Caddy haalt het HTTPS-certificaat zelf op zodra het domein naar de VPS wijst (een paar minuten tot een uur).

## Stap 3: controleren

Open `https://alternatievengids.nl/`, `/alternatief-voor/slack/`, `/vergelijk/`, `/sitemap.xml` en `/robots.txt`. `https://www.alternatievengids.nl/` hoort naar het adres zonder www te gaan. Een pagina die niet bestaat toont de 404-pagina.

## Stap 4: gevonden worden

Google Search Console en Bing Webmaster Tools: voeg alternatievengids.nl toe (verifieer met een DNS-record) en geef de sitemap door: `https://alternatievengids.nl/sitemap.xml`. Beide zijn Amerikaanse diensten en niet nodig voor de site zelf.

## Bijwerken

Niets te doen. GitHub bouwt elke ochtend (06:30 UTC, na de Baserow-sync van de scan) en bij elke wijziging op `main`; de VPS haalt het binnen vijf minuten op. Direct bijwerken op de VPS: `alternatievengids-update`.

## Let op: setup-vps.sh van de scan

Dat script schrijft de hele Caddyfile opnieuw. Draai je het opnieuw, dan verdwijnt de regel `import /etc/caddy/conf.d/*.caddy` en dus de Gids. Oplossing: draai `bash /root/setup-gids.sh` opnieuw (het vraagt dan niets meer behalve de sleutel-bevestiging), of laat setup-vps.sh die regel zelf toevoegen. Dat is een kleine wijziging in sovereignos: onderaan het blok dat de Caddyfile schrijft, vóór `EOF`, de regel `import /etc/caddy/conf.d/*.caddy` toevoegen, en `install -d /etc/caddy/conf.d` vóór het schrijven. Zonder die wijziging werkt alles, maar moet je het Gids-script na elke run van setup-vps.sh herhalen.

## Alternatief: Hostinger-webhosting

Wil je later toch op gewone webhosting: download in GitHub bij de laatste groene run (Actions) de zip `dist`, pak hem uit in `public_html` van het domein (zorg dat `.htaccess` meekomt) en stel het domein in bij dat pakket. De `.htaccess` stuurt `www` door; HTTPS dwing je dan af in hPanel (Beveiliging, SSL).

## Later verhuizen

De map in de branch `site` (of `dist/`) is de hele site en werkt op elke statische host. Verhuizen betekent: bestanden naar de nieuwe host en DNS omzetten. Een voorbeeld voor Caddy staat in `deploy/Caddyfile.example`.
