# Overdracht alternatievengids.nl

Startpunt voor elke sessie die aan deze site werkt. Lees ook `CLAUDE.md` (werkafspraken met Rik). Werk dit bestand bij aan het eind van een sessie.

## Het project in het kort

- **Wat:** een Nederlandstalige gids met Europese en open-source alternatieven voor Big Tech-software. Een product van Newground, geen aparte bv. Het domein alternatievengids.nl is gekocht.
- **Doel (Rik, 22 oktober):** verkeer, naamsbekendheid en een community opbouwen.
- **Zusterproduct:** de Soevereiniteitsscan op https://scan.newground.nl (repo `rheijmen/sovereignos`). De gids moet bezoekers naar de scan leiden; de scan is de plek waar een organisatie haar eigen afhankelijkheid meet.
- **Stand op 22 oktober:** deze repo heeft alleen een README, deze overdracht en `CLAUDE.md`. Er is nog niets gebouwd.

## Gedeelde bron: de alternatievenlijst in Baserow

Gebruik dezelfde lijst als de scan, zodat er één lijst is om bij te houden. Niet kopiëren naar een eigen database.

- **Baserow** (Nederlands bedrijf): database 576229, tabel 1243445, ongeveer 280 rijen op 22 oktober, op weg naar 1000.
- **Kant-en-klaar bestand:** een Make-scenario schrijft de hele tabel elke ochtend om 06:40 naar `data/verdicts.json` in `rheijmen/sovereignos`, en de scan serveert het op https://scan.newground.nl/data/verdicts.json (velden `generated`, `count`, `results`). Dat is de eenvoudigste bron voor deze site: geen sleutel nodig, alleen openbare gegevens.
- **Uitleg van alle kolommen en statussen:** `docs/gids/README.md` in `rheijmen/sovereignos`. Belangrijkste kolommen: *Name*, *Website*, *Category*, *Replaces* (de Amerikaanse producten die het vervangt, gescheiden met `;`), *Scanvraag*, *Relevant voor Sectoren*, *HQ / legal entity*, *Open source*, *Verdict* (Advise, Conditional of Watch: alleen Rik zet die), *Verdict reason* en *Verdict reason NL*, *Gidsstatus*, *Filteruitslag* (de toets met bronnen), de EU-scores *SOV-1* t/m *SOV-8*, *SEAL-niveau* en *Knelpunt*, *MKB-fit* en *Overheidstoeleverancier*.
- **Wat publiek mag:** alleen rijen met een *Verdict* of met *Gidsstatus* "Goedgekeurd door filter". Nooit *Kandidaat*, *Twijfel* (tenzij met een Verdict, en dan met de melding dat het eigendom verandert), *Afgewezen*, *Sectorkennis* of *Gangbaar product* als aanbeveling. Een *Gangbaar product* (bijvoorbeeld een Amerikaans EPD) mag wel als "alternatief voor"-onderwerp.
- **Wie de lijst vult:** drie geplande agents (Gids-Sector, Gids-Categoriser, Gids-Filter), beschreven in `docs/gids/` van sovereignos. Wijzigingen aan die agents gaan via die repo, niet via deze.
- **Bronnen die we niet mogen overnemen:** European Tech Map, european-alternatives.eu en euro-stack verbieden kopiëren. Alleen als spoor voor namen gebruiken. Rik stuurt de licentiemail aan European Tech Map niet.

## Advies van de scansessie (21 oktober, nog niet besloten)

Dit is een voorstel, geen besluit. Leg het eerst aan Rik voor, volgens `CLAUDE.md`.

1. **Statische pagina's, gemaakt uit de lijst.** De scan is een app en staat met opzet buiten Google (`noindex`). De gids moet juist gevonden worden: genereer na de ochtendsync gewone HTML-pagina's. Snel, goed vindbaar, en geen database of beheerpaneel nodig.
2. **Pagina's die zoekverkeer pakken:**
   - "Europees alternatief voor <product>": één per Amerikaans product uit *Replaces* (Slack, Dropbox, Google Analytics, ...). Dit is wat mensen intypen.
   - Eén pagina per alternatief: wat het is, waar het bedrijf zit, het oordeel van Newground, de EU-score als die er is, de bronnen.
   - Per categorie en per sector.
3. **Elke pagina verwijst naar de scan** ("Hoe afhankelijk is jouw organisatie? Doe de gratis scan").
4. **Community klein beginnen:** een formulier "Mis je een alternatief?" dat in Baserow landt als *Kandidaat* (met *Toegevoegd door* = bezoeker; de Filter toetst het dan vanzelf), en een maandelijkse nieuwsbrief (bijvoorbeeld Brevo, Frans) met nieuwe alternatieven en eigendomsalarmen. Een forum of reacties pas later: dat vraagt moderatie.
5. **Geloofwaardigheid:** een pagina "Hoe we beoordelen" en eerlijkheid over belangen (Newground levert zelf onder meer Nextcloud).
6. **Techniek, Europees en eenvoudig:** zelf hosten op dezelfde Hostinger-VPS als de scan (Caddy met automatische HTTPS), of een andere Europese host. Bezoekers meten zonder cookies, op eigen server. Niets van andere websites laden (geen Google Fonts, geen externe scripts).

## Open vragen voor Rik

1. Wat de gids laat zien: alleen beoordeelde en goedgekeurde producten (advies), of ook kandidaten met een label.
2. Nieuwsbrief via Brevo: ja of nee.
3. Hosting: op de VPS van de scan of ergens anders. Daarna moet het domein in Riks domeinbeheer naar die server wijzen (A-record).
4. Merk en uitstraling: dezelfde huisstijl als Newground, of een eigen gezicht met "een initiatief van Newground".

## Valkuilen die de scansessie al tegenkwam

- **Server van de scan:** `setup-vps.sh` in sovereignos overschrijft de Caddyfile. Een tweede site op dezelfde server vraagt eerst een aanpassing van dat script, anders verdwijnt de gids bij de volgende installatie. Alleen Rik draait dat script, als root.
- **De API van de scan** accepteert alleen verzoeken van zijn eigen origin. Een formulier op deze site kan dus niet zomaar die API gebruiken: eigen endpoint of een Make-webhook.
- **Geen geheimen in de repo of in de chat:** de Baserow-sleutel staat alleen op de server.
- **Downloads van github.com** geven een 403 in de sandbox; raw.githubusercontent.com werkt wel.
- **`pkill -f`** kan de shell van de sessie afschieten. Niet gebruiken.
