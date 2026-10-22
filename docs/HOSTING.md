# alternatievengids.nl online zetten

Op de VPS waar ook de scan op draait, met het domein bij Hostinger. Drie stappen, de eerste twee zijn eenmalig. De repo is openbaar, dus de VPS heeft geen sleutel of inlog nodig.

```
GitHub bouwt (bij elke wijziging en elke ochtend)  ->  branch "site"  ->  VPS haalt elke 5 minuten op  ->  Caddy
```

## Eerst nalopen

1. Teksten die over jou en Newground gaan: `/hoe-we-beoordelen/`, `/over/`, `/sponsor/` (zie `docs/OVERDRACHT.md`).
2. Simple Analytics: voeg alternatievengids.nl toe als website in je account, anders telt het niets.

## Stap 1: DNS bij Hostinger (een keer)

hPanel, Domeinen, alternatievengids.nl, DNS-records:

- A-record `@` naar het IP-adres van de VPS (hPanel, VPS, overzicht; hetzelfde adres als `scan.newground.nl`).
- A-record `www` naar hetzelfde IP-adres.
- Haal bestaande A-, AAAA- en CNAME-records voor `@` en `www` weg (bijvoorbeeld een parkeerpagina).
- Voeg dit domein NIET toe als website bij een webhostingpakket; dan wijst het naar Hostinger in plaats van naar de VPS.

## Stap 2: een regel op de VPS (een keer)

Open de Webconsole van de VPS in hPanel (als root), plak deze regel en druk op Enter:

```
curl -fsSL https://raw.githubusercontent.com/rheijmen/alternatievengids/main/deploy/setup-vps-gids.sh | bash
```

Het script stelt geen vragen. Het haalt de site op, zet bijwerken elke 5 minuten aan en voegt de site aan Caddy toe. Caddy wordt eerst getest; keurt hij de configuratie af, dan zet het script alles terug en blijft de scan ongemoeid. Aan het eind staat "Klaar".

## Stap 3: controleren

Caddy haalt het HTTPS-certificaat zelf op zodra het domein naar de VPS wijst (een paar minuten tot een uur). Open `https://alternatievengids.nl/`, `/alternatief-voor/slack/`, `/vergelijk/`, `/sitemap.xml` en `/robots.txt`. `https://www.alternatievengids.nl/` hoort naar het adres zonder www te gaan.

## Gevonden worden

Google Search Console en Bing Webmaster Tools: voeg alternatievengids.nl toe (verifieer met een DNS-record) en geef de sitemap door: `https://alternatievengids.nl/sitemap.xml`. Beide zijn Amerikaanse diensten en niet nodig voor de site zelf.

## Bijwerken

Niets te doen. GitHub bouwt elke ochtend (06:30 UTC, na de Baserow-sync van de scan) en bij elke wijziging op `main`; de VPS kijkt elke 5 minuten of er iets nieuws is (dat kost bijna niets) en haalt het dan op. Bij elke nieuwe versie ruimt het bijwerkscript de oude versies op, zodat de schijf niet volloopt. Direct bijwerken op de VPS: `alternatievengids-update`.

## Let op: setup-vps.sh van de scan

Dat script schrijft de hele Caddyfile opnieuw. Draai je het opnieuw, dan verdwijnt de regel `import /etc/caddy/conf.d/*.caddy` en dus de Gids. Oplossing: plak de regel uit stap 2 nog eens (30 seconden), of laat setup-vps.sh die regel zelf toevoegen. Dat is een kleine wijziging in sovereignos: onderaan het blok dat de Caddyfile schrijft, vóór `EOF`, de regel `import /etc/caddy/conf.d/*.caddy` toevoegen, en `install -d /etc/caddy/conf.d` vóór het schrijven.

## Als de repo later toch privé moet

Zet de repo NIET eerst op privé: dan kan de VPS de site niet meer ophalen en blijft de site stilzwijgend op de laatste versie staan. Doe het in deze volgorde:

1. **Op de VPS** (Webconsole, als root): `USE_KEY=1 alternatievengids-setup`. Het script maakt een leessleutel, past het adres van de bestaande kopie aan en toont de sleutel.
2. **In GitHub:** repo, Settings, Deploy keys, Add deploy key, titel "VPS", plak de sleutel, laat "Allow write access" UIT. Terug in de console op Enter drukken.
3. **Pas daarna** de repo op privé zetten (Settings, onderaan Danger zone, Change visibility).
4. **Controleer** op de VPS met `alternatievengids-update`. Komt er geen foutmelding, dan werkt het.

Daarna werkt de eenregelige installatie via `curl` niet meer voor een nieuwe server (het raw-adres van GitHub vraagt dan om een inlog); op die server plak je het script dan met de hand. De site zelf blijft openbaar. GitHub rekent voor privé-repo's een maandelijks aantal gratis bouwminuten; de Gids gebruikt ongeveer een minuut per dag.

Terug naar openbaar: eerst de repo openbaar maken, daarna op de VPS `alternatievengids-setup` zonder `USE_KEY`.

## Alternatief: Hostinger-webhosting

Download in GitHub bij de laatste groene run (Actions) de zip `dist`, pak hem uit in `public_html` van het domein (zorg dat `.htaccess` meekomt) en stel het domein in bij dat pakket. De `.htaccess` stuurt `www` door; HTTPS dwing je dan af in hPanel (Beveiliging, SSL).

## Later verhuizen

De map in de branch `site` (of `dist/`) is de hele site en werkt op elke statische host. Verhuizen betekent: bestanden naar de nieuwe host en DNS omzetten. Een voorbeeld voor Caddy staat in `deploy/Caddyfile.example`.
