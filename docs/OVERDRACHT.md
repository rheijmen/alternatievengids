# Overdracht alternatievengids.nl

Startpunt voor elke sessie die aan deze site werkt. Lees ook `CLAUDE.md` (werkafspraken met Rik) en `README.md` (techniek). Werk dit bestand bij aan het eind van een sessie.

## Het project in het kort

- **Wat:** een Nederlandstalige gids met Europese en open-source alternatieven voor Big Tech-software. Een initiatief van Newground, geen aparte bv. Het domein alternatievengids.nl is gekocht.
- **Doel (Rik, 22 oktober):** verkeer, naamsbekendheid en een community opbouwen. Het is ook een SEO- en GEO-platform (gevonden worden door zoekmachines en AI-zoekers): alles wordt beoordeeld op behulpzaamheid en vindbaarheid.
- **Zusterproduct:** de Soevereiniteitsscan op https://scan.newground.nl (repo `rheijmen/sovereignos`). Elke pagina verwijst ernaartoe.
- **Stand op 22 oktober:** versie 0.1 gebouwd (draft-PR). Nog niet gepubliceerd: hosting, domein en formulier-endpoint zijn nog te regelen (zie "Wat Rik nog moet doen").

## Besluiten van Rik (22 oktober)

1. **Statisch voorgerenderd**, uit de lijst gemaakt na de ochtendsync. Geen app.
2. **Dezelfde logica als de scan**: de bouw haalt de modules en `data/verdicts.json` van de scan en gebruikt die zelf (zie README). Niets is gekopieerd.
3. **Kandidaten tonen, met label** "Nog niet beoordeeld". Alleen beoordeeld/goedgekeurd tonen was het advies; Rik koos de ruimere variant. Daarom zijn die pagina's `noindex` (zie hieronder) en toont een kandidaat alleen neutrale feiten.
4. **Hosting:** starten op Hostinger en later eventueel verhuizen. De bouw levert een map (`dist/`) op die elke statische host kan serveren, dus verhuizen kost niets.
5. **Uitstraling:** rustig en overzichtelijk zoals european-alternatives.eu (die site was vanuit de sandbox niet te bekijken; de opzet is gebouwd op het bekende patroon: zoekveld bovenaan, tegels per product en categorie, rustige lijsten met filters), in Newgrounds eigen stijl (zwart-wit, arcering, Baloo 2) uit de scan.
6. **Newground is zelf sponsor:** een duidelijk gemarkeerde sponsorbanner ("Sponsor", `rel="sponsored"`), en onderaan elke pagina drie lege sponsorvakken met een plus. Klik opent een voorgevulde mail aan Rik. Er is een pagina `/sponsor/`.
7. **Analytics:** Simple Analytics, zoals op newground.nl (script en noscript-pixel). De badge staat uit (`analytics.badge` in `data/site.json`).
8. **Inzenden:** een modal (ook als eigen pagina `/dien-in/`) waarin je kiest: gebruiker of fan, producent of leverancier. Basisvelden plus toelichting. Producent en leverancier moeten aankruisen dat ze updates willen doorgeven en vragen willen beantwoorden; voor een fan is dat optioneel.

9. **Kandidaten blijven `noindex` tot ze getoetst zijn.** Een product wordt vanzelf indexeerbaar zodra de Filter het goedkeurt of Rik een oordeel zet.
10. **Hosting start op Hostinger webhosting** (dist/ uploaden, zoals newground.nl), niet op de VPS van de scan. Simple Analytics laadt daarom vooralsnog van Simple Analytics zelf.
11. **AI-zoekers en assistenten mogen alles lezen en citeren** (robots.txt staat het toe, `llms.txt` helpt). Bronvermelding voor CC BY-SA-gegevens blijft verplicht.
12. **Volgende uitbreidingen, in deze volgorde:** vergelijkpagina's (gedaan, zie hieronder), use-case pagina's ("Slack vervangen voor een stichting") en een pagina "Gewijzigd deze maand". Nieuwsbrief via Brevo: nog niet gekozen.

## Wat er staat

- 222 producten (32 beoordeeld, 190 nog niet), 119 doelen waarvan 74 met een eigen pagina, 24 categorieen, 1 sectorpagina (Overheid) en 88 vergelijkpagina's (19 indexeerbaar). Tellingen staan in `dist/build.json` na een bouw.
- **Vergelijkpagina's** (`/vergelijk/a-vs-b/`, "A of B"): alleen producten die Newground allebei heeft beoordeeld, in dezelfde categorie, die minstens één hetzelfde product vervangen, en waarvan beide een tekst van Newground hebben. Alles komt uit de data (oordeel, land, open source, levering, overheidsreferenties, eigen beoordelingstekst); er is niets verzonnen. Alleen paren waarbij beide Advies of Onder voorwaarden hebben zijn indexeerbaar en staan in de sitemap; een paar met een product op Volgen is zichtbaar maar `noindex`. Vindbaar via de footer, de startpagina, productpagina's, doelpagina's, `/vergelijk/` en `llms.txt`. Logica: `buildComparisons` in `scripts/lib/model.mjs`, pagina in `scripts/lib/pages.mjs`.
- Per pagina: een "Kort antwoord" bovenaan, gestructureerde data (BreadcrumbList, FAQPage op de startpagina en doelpagina's, CollectionPage met ItemList), canonical, Open Graph, sitemap, `robots.txt` die AI-crawlers expliciet toestaat, `llms.txt` en `llms-full.txt`.
- Filters (open source, Nederlands, overheid, mkb) en zoeken met een tikfout werken in de browser; zonder JavaScript blijft alles bruikbaar als gewone links.
- CSP per pagina: alleen eigen server plus Simple Analytics. Geen inline scripts of styles, geen externe lettertypen.
- Tests: `npm test` (24 tests: statusregels, parser, bouw, sponsorvakken, analytics, GEO, en dat de rangschikking overeenkomt met die van de scan). `npm run check` controleert de gebouwde site (0 fouten).

## Wat Rik nog moet doen

1. **Draft-PR bekijken** en laten weten wat anders moet (zie de vragen onderaan het gesprek).
2. **Hosting en domein:** stap voor stap in `docs/HOSTINGER.md`. Hostinger-pakket kiezen of de VPS van de scan gebruiken. Op de VPS moet eerst `setup-vps.sh` in sovereignos een tweede site aankunnen (het overschrijft nu de Caddyfile; voorbeeld in `deploy/Caddyfile.example`). Bij gewone Hostinger-hosting: `dist/` uploaden (`static/.htaccess` zit erbij). Daarna het A-record van alternatievengids.nl. De GitHub-workflow bouwt en controleert al elke ochtend; publiceren volgt na de hostingkeuze.
3. **Simple Analytics:** alternatievengids.nl toevoegen als site in het account (anders telt hij niets).
4. **Inzendingen laten aankomen:** nu opent het formulier een ingevulde mail (werkt direct). Voor Baserow: een Make-webhook of eigen endpoint, het webadres in `submit.endpoint` in `data/site.json` zetten, en de privacyverklaring wordt dan vanzelf aangepast. De webhook moet CORS toestaan, anders valt het formulier terug op de mail. Nieuwe Baserow-kolommen nodig (de Baserow-tool kan ze niet maken): *Indiener rol*, *Indiener naam*, *Indiener e-mail*, *Bereid tot updates*, *Inzending toelichting*, *Ingediend op*. De rest past op bestaande kolommen: Name, Website, Replaces, HQ / legal entity, Open source, *Gidsstatus* = Kandidaat, *Toegevoegd door* = "Bezoeker (rol)".
5. **Teksten controleren die uitspraken doen over jou en Newground:** `/hoe-we-beoordelen/` (zegt dat AI-assistenten een deel van het zoeken en toetsen doen maar nooit een oordeel geven; "sponsoring koopt zichtbaarheid, geen oordeel"), `/over/` en `/sponsor/`. En de belangenlijst (`belangen.ids` in `data/site.json`: nextcloud-hub, nc-talk, nc-files; afgeleid van "Newground offers Nextcloud itself" in Baserow): klopt die?
6. **Privacyverklaring nalopen:** noemt Hostinger als host; de datacenterlocatie is nog niet bevestigd (zie ook sovereignos, `HOSTING.datacenter`).
7. **CC BY-SA:** 42 rijen komen uit CC BY-SA-bronnen (switching.software, awesome-european-cloud). Nu staat op `/bronnen/` bronvermelding. Beslis of de hele lijst onder dezelfde licentie wordt gedeeld (share-alike), wat ook voor een eventuele open dataset telt.
8. **Baserow vullen:** Nederlandse redenen (*Verdict reason NL*) bij oordelen (zonder staat er geen uitleg op de pagina), *Relevant voor Sectoren* (alleen Overheid heeft nu genoeg rijen voor een sectorpagina; minimum is 3 per sector, `minSectorPage`).

## Afwijkingen van de werkafspraken, bewust gemaakt

- **Simple Analytics laadt een script van een andere site** (scripts.simpleanalyticscdn.com). `CLAUDE.md` zegt: laad nooit iets van een andere website. Rik vroeg om dezelfde analytics als newground.nl; het is een Nederlandse, cookieloze dienst en de privacyverklaring noemt het. Strengere variant voor later: het script via het eigen domein laten lopen (Simple Analytics ondersteunt een proxy; vraagt een server met Caddy, niet gewone shared hosting).
- **Kandidaten staan `noindex`** tot Rik `indexUnrated` aanzet in `data/site.json`: ze zijn niet getoetst en de gegevens komen deels van agents. Een pagina kan wel gevonden worden via de site zelf. Dit is een voorstel, geen besluit.

## Gedeelde bron: de alternatievenlijst in Baserow

Gebruik dezelfde lijst als de scan, zodat er één lijst is om bij te houden. Niet kopiëren naar een eigen database.

- **Baserow** (Nederlands bedrijf): database 576229, tabel 1243445.
- **Kant-en-klaar bestand:** een Make-scenario schrijft de hele tabel elke ochtend om 06:40 naar `data/verdicts.json` in `rheijmen/sovereignos`; de scan serveert het op https://scan.newground.nl/data/verdicts.json (velden `generated`, `count`, `results`).
- **Uitleg van alle kolommen en statussen:** `docs/gids/README.md` in `rheijmen/sovereignos`. Wijzigingen aan de drie agents (Gids-Sector, Gids-Categoriser, Gids-Filter) gaan via die repo.
- **Wat publiek mag:** zie README, "Wat publiek is". Een *Gangbaar product* mag als "alternatief voor"-onderwerp (dat gebeurt automatisch als een product het in *Replaces* noemt).
- **Bronnen die we niet mogen overnemen:** European Tech Map, european-alternatives.eu en euro-stack verbieden kopiëren. Alleen als spoor voor namen. Dat geldt ook voor ons ontwerp: we nemen de opzet als inspiratie, geen tekst of data.
- De scan kan veranderen. `scripts/lib/scan.mjs` controleert bij elke bouw of de verwachte functies er nog zijn en stopt met een duidelijke melding als dat niet zo is.

## Backlog (nog niet gebouwd)

- Open Graph-afbeelding (nu alleen tekst), PNG-favicon.
- **Eerstvolgend (besluit Rik, 22 oktober):**
  - ~~Vergelijkpagina's~~: gebouwd (zie "Wat er staat"). Wordt automatisch groter naarmate de Filter meer producten beoordeelt; vergelijkingen met een product zonder oordeel bestaan bewust niet. Om de vergelijking te verrijken: *Verdict reason NL* in Baserow vullen (nu bij 8 paren hebben beide kanten een Nederlandse beoordeling, bij 81 minstens een korte beschrijving).
  - Use-case pagina's: vragen redactie van Rik of Newground (we verzinnen geen praktijkverhalen); een sjabloon met verwijzing naar de scan en een klankbordgesprek kan wel vooraf.
  - Gewijzigd deze maand: vraagt dat de bouw het vorige `verdicts.json` bewaart om verschillen te zien (bijvoorbeeld `data/snapshots/` of een artifact van de vorige bouw). Eerst ontwerpen.
- Nieuwsbrief via Brevo (Frans) met nieuwe alternatieven en eigendomsalarmen: nog geen besluit.
- Koppeling scan: "Gebruik je X?" opent de scan nu op de startpagina. De scan heeft geen route om een product voor te selecteren; als die er komt, kan elke Gids-pagina de scan met dat product starten.
- Forum of reacties: pas later, vraagt moderatie.
- Open dataset (JSON) van de publieke velden voor AI-zoekers en onderzoekers: wacht op het licentiebesluit.
- Vergelijkpagina's ("A tegenover B"), pagina's per use-case ("Slack vervangen voor een stichting"), een lijst "Gewijzigd deze maand" (eigendomsalarmen en nieuwe producten) en een Engelse versie.

## Valkuilen

- **Server van de scan:** `setup-vps.sh` in sovereignos overschrijft de Caddyfile. Een tweede site op dezelfde server vraagt eerst een aanpassing van dat script. Alleen Rik draait dat script, als root.
- **De API van de scan** accepteert alleen verzoeken van zijn eigen origin; daarom heeft de Gids een eigen formulier-endpoint nodig.
- **Geen geheimen in de repo of in de chat.** De Baserow-sleutel staat alleen op de server; een webhook-adres in `data/site.json` is wel openbaar zichtbaar: gebruik er een met alleen schrijfrechten voor kandidaten en filter spam in het scenario.
- **De bouw voert code van de scan uit** (haalt `js/data/*.js` op). Dat is onze eigen site; wie de scan kan wijzigen, kan dus ook de Gids-bouw beinvloeden.
- **sovereignos lokaal nodig voor mijn sandbox:** scan.newground.nl is vanuit de cloud-sandbox geblokkeerd; gebruik daar `SCAN_DIR=/pad/naar/sovereignos`. In GitHub Actions werkt `SCAN_ORIGIN`.
- **CSP in de pagina** is met `esc()` HTML-escaped (`&#39;`); tests die erop zoeken moeten daar rekening mee houden.
- **Downloads van github.com** geven een 403 in de sandbox; raw.githubusercontent.com werkt wel. **`pkill -f`** kan de shell afschieten: niet gebruiken.
