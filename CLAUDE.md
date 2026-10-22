# Werkafspraken met Rik

Rik is ondernemer en geen programmeur. Hij is perfectionistisch en wil het beste resultaat, niet alleen de letterlijke opdracht.

## Eerst toetsen, dan bouwen
- Zie je een betere, eenvoudigere of veiligere aanpak dan wat Rik vraagt? Voer de opdracht dan niet zomaar uit. Leg eerst kort uit wat je anders zou doen en waarom, en laat Rik kiezen.
- Dat geldt ook halverwege: kom je tijdens het werk iets tegen waardoor het plan beter kan, stop dan en meld het voordat je verder bouwt.
- Kleine, duidelijke opdrachten zonder twijfel voer je direct uit.

## Vraag om het doel
- Is een opdracht erg sturend ("doe X op manier Y") en zou het resultaat beter worden als je het doel kende? Vraag dan naar het doel ("wat wil je dat de bezoeker hiermee doet of voelt?").
- Je mag Rik vragen om zijn opdrachten doelgerichter te formuleren als dat het resultaat beter maakt.

## Europese alternatieven eerst
- Bij elke technische keuze (hosting, database, e-mail, AI-model, betalingen, analytics, lettertypen, CDN, code-opslag, monitoring) kies je standaard een goed werkend Europees of open-source alternatief voor Amerikaanse big tech.
- Kwaliteit telt: is het Amerikaanse alternatief duidelijk beter of het Europese nog niet volwassen, zeg dat eerlijk, laat Rik kiezen en bouw het zo dat je later kunt overstappen.
- Gebruik je toch een Amerikaanse dienst, noem die dan in het Trust Center met de reden, en zet hem op de lijst om te vervangen.
- Laad nooit iets van een andere website (lettertypen, scripts, statistieken): alles komt van onze eigen server.

## Toon
- Nederlands, direct, geen emoji's, geen vakjargon zonder uitleg.

## Formulieren: vergevingsgezind en in eigen taal
- Geldt voor ALLE velden, ALTIJD. Nooit de meldingen van de browser tonen (die zijn Engels en onduidelijk, bijvoorbeeld "Please enter a URL.").
- Dus: geen `type="url"`, `email`, `number`, `tel` of `date`, geen `required`, en `novalidate` op het formulier. Gebruik `type="text"` met `inputmode` en `autocomplete`.
- Maak invoer ruimhartig: "voorbeeld.nl" zonder https:// of www is gewoon goed (wij voegen dat toe), spaties eromheen worden weggehaald, hoofdletters in e-mail genegeerd.
- Foutmeldingen komen onder het veld, in de taal van de pagina, en zeggen wat de bezoeker moet doen, met een voorbeeld ("Vul het zo in: voorbeeld.nl"). Koppel ze met `aria-invalid` en `aria-describedby`, zet de focus op het eerste foute veld.
- Zonder JavaScript is er een mail-terugval. `scripts/check.mjs` keurt de verboden velden af.

## Nieuwe sessie
- Lees eerst `docs/OVERDRACHT.md`: doel, stand van zaken, gedeelde bronnen en open keuzes. Werk dat bestand bij aan het eind van een sessie.
