# alternatievengids.nl online zetten op Hostinger

Voor gewone Hostinger-webhosting (zoals newground.nl), niet de VPS. De site is statisch: een map met bestanden, geen database en geen WordPress. Menunamen in hPanel kunnen iets afwijken; Hostinger past ze regelmatig aan.

## Eerst nalopen (5 minuten)

1. Teksten die over jou en Newground gaan: `/hoe-we-beoordelen/`, `/over/`, `/sponsor/` (zie `docs/OVERDRACHT.md`, punt 5).
2. Simple Analytics: voeg alternatievengids.nl toe als website in je account, anders telt het niets.
3. PR met `.htaccess` en de download-aanpassing is gemerged (anders mist de zip het bestand `.htaccess`).

## Stap 1: website aanmaken in hPanel

1. hPanel, Websites, Website toevoegen. Kies de optie voor een lege website of eigen bestanden uploaden. Niet WordPress en niet de Website Builder.
2. Kies het bestaande domein alternatievengids.nl. Kan je pakket geen extra website meer? Dan heb je een ruimer webhosting-pakket nodig (het aantal websites verschilt per pakket; hPanel toont wat je nog hebt).

## Stap 2: het domein laten wijzen

- **Domein gekocht bij Hostinger:** wordt vanzelf gekoppeld.
- **Domein elders gekocht:** kies een van twee.
  - Nameservers bij je registrar wijzigen naar die van Hostinger (hPanel toont ze bij het domein). Makkelijkst.
  - Of een A-record voor alternatievengids.nl naar het IP-adres van je hosting, en een CNAME voor `www` naar alternatievengids.nl.
- Het duurt van enkele minuten tot ongeveer een dag voor het overal werkt.

## Stap 3: HTTPS

hPanel, Beveiliging, SSL: installeer het gratis certificaat voor alternatievengids.nl en zet "Force HTTPS" aan. Dit kan pas als het domein naar Hostinger wijst.

## Stap 4: de bestanden uploaden

1. Download de nieuwste bouw: GitHub, repo `rheijmen/alternatievengids`, tab Actions, workflow "Bouwen en controleren", de laatste run met een groen vinkje. Onderaan bij Artifacts staat `dist`: download die (een zip). Er komt elke ochtend een nieuwe.
2. hPanel, Bestanden, Bestandsbeheer. Ga naar de map `public_html` van alternatievengids.nl (bij een extra website kan dat een map per domein zijn). Verwijder het standaardbestand dat Hostinger erin zet (bijvoorbeeld `default.php`).
3. Upload de zip in die map en pak hem uit (rechtsklik, Uitpakken).
4. Controleer dat `index.html` rechtstreeks in `public_html` staat, niet in een submap `dist`. Zet "verborgen bestanden tonen" aan en controleer dat `.htaccess` er staat.

## Stap 5: controleren

Open en kijk of ze werken: `https://alternatievengids.nl/`, `/alternatief-voor/slack/`, `/vergelijk/`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`. Ga ook naar `https://www.alternatievengids.nl/`: die hoort naar het adres zonder www te gaan. Gaat een pagina fout of krijg je een eindeloze omleiding, schakel dan Force HTTPS uit en weer aan, en meld het.

## Stap 6: meten en gevonden worden

- Simple Analytics toont bezoek zodra je de site een paar keer hebt geopend.
- Google Search Console en Bing Webmaster Tools: voeg alternatievengids.nl toe (verifieer met een DNS-record) en geef de sitemap door: `https://alternatievengids.nl/sitemap.xml`. Beide zijn Amerikaanse diensten en niet nodig voor de werking van de site; ze helpen wel om te zien hoe je gevonden wordt.

## Bijwerken

De lijst wordt elke ochtend ververst, maar de site op Hostinger verandert pas als je opnieuw uploadt (stap 4, bestanden overschrijven). Automatisch publiceren kan later: GitHub zet na elke bouw de bestanden zelf op Hostinger, zoals bij newground.nl. Dat vraagt een Hostinger-sleutel of FTP-gegevens als GitHub-secret. Zet die nooit in de chat of in de repo.

## Later verhuizen

De map `dist/` is de hele site en werkt op elke statische host. Verhuizen betekent: bestanden naar de nieuwe host, DNS omzetten, klaar. Op een eigen server met Caddy staat een voorbeeld in `deploy/Caddyfile.example`.
