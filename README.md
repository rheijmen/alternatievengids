# alternatievengids

Een Nederlandse gids voor (Europese) soevereine alternatieven voor Big Tech oplossingen. Een initiatief van Newground, op alternatievengids.nl.

Start elke sessie met `CLAUDE.md` en `docs/OVERDRACHT.md`.

## Hoe het werkt

De Gids is een **statische site**: een bouwscript maakt gewone HTML-pagina's uit dezelfde alternatievenlijst en met dezelfde regels als de Soevereiniteitsscan (https://scan.newground.nl, repo `rheijmen/sovereignos`). Er is geen database en geen server nodig om de site te tonen.

```
Baserow  ->  scan: data/verdicts.json (dagelijks 06:40)  ->  deze bouw  ->  dist/  ->  host
                      scan: js/data/*.js (de regels)  ->
```

De bouw haalt `data/verdicts.json` en de modules `js/data/alternatives.js`, `catalog.js`, `tasks.js` en `js/config.js` van de scan en voert ze uit. Dus: dezelfde `applyVerdicts()` en `fromBaserow()` bepalen wat een alternatief is en welk oordeel het heeft, dezelfde rangschikking bepaalt de volgorde. Verandert de scan, dan volgt de Gids bij de volgende bouw. Bijwerken in de scan-repo hoeft niet.

## Gebruik

Vereist Node 22. Geen afhankelijkheden.

```sh
SCAN_DIR=../sovereignos npm run build   # bouwen uit een lokale kopie van de scan
npm run build                           # bouwen uit de openbare scan (SCAN_ORIGIN, standaard scan.newground.nl)
npm run check                           # controleert dist/: links, SEO-basis, geen externe bronnen, enzovoort
npm test                                # tests (zet SCAN_DIR of SCAN_ORIGIN voor de bouwtests)
npm run preview                         # http://localhost:8765
```

## Waar wat staat

```
data/site.json            instellingen: sponsorvakken, analytics, formulier-endpoint, belangenlijst, indexeren van kandidaten
data/target-aliases.json  naam uit Baserow -> product uit de catalogus (voorkomt dubbele "alternatief voor"-pagina's)
scripts/lib/scan.mjs      haalt de bronnen van de scan op
scripts/lib/model.mjs     statusregels, doelen, categorieen, sectoren; bouwt voort op de regels van de scan
scripts/lib/pages.mjs     alle pagina's
scripts/lib/render.mjs    layout, sponsor, formulier en modal, analytics, CSP
scripts/lib/site.mjs      bouwt alles naar dist/, plus sitemap, robots.txt, llms.txt, zoek.json
scripts/check.mjs         controle van de gebouwde site
static/                   css, js, lettertypen, logo (overgenomen uit de scan), .htaccess
deploy/                   voorbeeld Caddyfile
```

## Pagina's

Start; `/alternatief-voor/` en `/alternatief-voor/<product>/` ("Europees alternatief voor Slack"); `/alternatieven/<product>/`; `/categorie/<soort>/`; `/sector/<sector>/` (alleen met genoeg producten); `/hoe-we-beoordelen/`; `/over/`; `/bronnen/`; `/sponsor/`; `/dien-in/`; `/privacy/`. Verder `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt` en `zoek.json`.

## Wat publiek is

Regels uit `docs/OVERDRACHT.md`, vastgelegd in `scripts/lib/model.mjs` (`excludeReason`) en bewaakt door tests: nooit *Afgewezen*, *Sectorkennis*, *Gangbaar product*, *Twijfel* zonder oordeel, of rijen die geen product zijn. Producten zonder oordeel staan er wel, zichtbaar als "Nog niet beoordeeld", en zijn `noindex` tot Rik dat in `data/site.json` aanzet (`indexUnrated`).
