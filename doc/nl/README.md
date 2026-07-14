![Logo](../../admin/automatic-feeder.png)
# ioBroker.automatic-feeder

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

## automatic-feeder-adapter voor ioBroker

Deze adapter maakt van een willekeurige, reeds aanwezige ioBroker-schakelaar (een
stopcontact, een relais, een GPIO-uitgang …) een **tijdgestuurde voederautomaat**. Hij
schakelt de uitgang op de door jou ingestelde tijden in voor een vastgelegd aantal seconden
en kan daarbij rekening houden met temperatuur en de dag-/nachtwisseling, zodat er nooit op het
verkeerde moment wordt gevoerd.

Dit document is een volledige handleiding. Als je de adapter nog nooit hebt gebruikt,
lees het dan van boven naar beneden – de **snelstart** brengt je in enkele minuten tot de eerste
voedering, de rest legt elke instelling in detail uit.

---

## Inhoudsopgave

1. [Wat de adapter doet](#1-wat-de-adapter-doet)
2. [Vereisten](#2-vereisten)
3. [Installatie](#3-installatie)
4. [Snelstart](#4-snelstart--de-eerste-voedering)
5. [De instellingenpagina in detail](#5-de-instellingenpagina-in-detail)
6. [Objecten / datapunten](#6-objecten--datapunten)
7. [Voorbeelden / recepten](#7-voorbeelden--recepten)
8. [Telegram-meldingen](#8-telegram-meldingen)
9. [Probleemoplossing & FAQ](#9-probleemoplossing--faq)
10. [Logging & foutopsporing](#10-logging--foutopsporing)
11. [Dynamisch voeren — achtergrond & bronnen](#11-dynamisch-voeren--achtergrond--bronnen)
---

## 1. Wat de adapter doet

Een „voedering" is in de kern heel eenvoudig: **uitgang AAN → een instelbaar aantal seconden
wachten → weer UIT**. Bij een omgebouwde voederautomaat draait in die tijd de motor en
geeft voer af.

De adapter beheert **tot 5 schakelaars**, elk volledig onafhankelijk en met een eigen
configuratie-tabblad dat naar de schakelaar is genoemd. Per schakelaar leg je vast:

* **wanneer** er wordt gevoerd – ofwel op **vaste tijden** (bijv. 08:00 en 18:00) of in een
  **interval** binnen een tijdvenster (bijv. elke 60 minuten tussen 08:00 en 18:00);
* **hoe lang** de uitgang ingeschakeld blijft (voederduur in seconden);
* **of er wordt geblokkeerd** wanneer de water- of luchttemperatuur te laag/hoog is;
* **of het voeren wordt beperkt** tot het astronomische dagvenster (zonsop-/-ondergang met
  offsets per schakelaar, uit een systeem-, gedeelde of per-schakelaar-locatie);
* **of het schakelproces wordt bewaakt** (controle of er werkelijk is in- en uitgeschakeld)
  en optioneel een **Telegram**-bericht over het resultaat wordt verzonden;
* **of het voeren wordt verminderd of gepauzeerd** tijdens een terugkerend **winter**seizoen –
  optioneel met Telegram-herinneringen voordat het begint en eindigt;
* **of het interval en de portie automatisch aan de water-/luchttemperatuur worden aangepast**
  (**dynamisch voeren**, Q10-model);
* **of het voeren wordt geblokkeerd** wanneer het opgeloste **zuurstof** (O₂) te laag is;
* **tot 3 eenmalige voederpauzes** (absolute datum-tijd-perioden, bijv. een quarantaine na het
  bijzetten van nieuwe vissen) met een **Telegram**-bericht aan het begin en einde van elke pauze;
* een **hoofdpauzeschakelaar** (*Voeding nu opschorten*) die meteen **alle** voedering voor een
  schakelaar opschort totdat je hem weer uitschakelt, met een **Telegram**-bericht bij elke omschakeling.

Je kunt een voedering op elk moment **handmatig** activeren – rechtstreeks op de instellingenpagina
(knop met vrij te kiezen duur) of via een datapunt (bijv. een knop in een
VIS-weergave).

Optioneel integreert de adapter de **Automatic-Feeder relaisprint** (een ESP32 met drie
timerknoppen en een eigen webinterface). Je bepaalt **per schakelaar** of deze zo'n print gebruikt;
schakel je dit voor een schakelaar in de algemene instellingen in, dan krijgt díe schakelaar een
**Relais**-tabblad waar je het netwerkadres van de print instelt, de verbinding test en de drie
knopvoedertijden (S1–S3) rechtstreeks vanuit de adapter configureert.

> Belangrijk: De adapter legt de schakelaar niet zelf aan. Hij **stuurt een reeds aanwezig
> object** in jouw ioBroker aan. Dit object kies je in de configuratie.

---

## 2. Vereisten

| Je hebt nodig | Details |
|-------------|---------|
| **ioBroker** met actuele **admin** (≥ 7) | De configuratiepagina is met React gerealiseerd. |
| **Een schakelaar-object** | Een beschrijfbaar ioBroker-datapunt dat de voederautomaat in-/uitschakelt – bijv. een stopcontact (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), een relais of een scriptvariabele. |
| *(optioneel)* **Geocoördinaten** | Gebruikt om zonsop-/-ondergang te berekenen voor het **astronomische venster** per schakelaar. Alleen nodig als een schakelaar dat venster gebruikt; overgenomen uit de ioBroker-systeeminstellingen, één gedeelde positie of per schakelaar geconfigureerd. |
| *(optioneel)* Temperatuur-objecten | Aanwezige datapunten met lucht- en/of watertemperatuur, voor temperatuurblokkering of dynamisch voeren. **Per schakelaar** toegewezen op het schakelaar-tabblad. |
| *(optioneel)* **Zuurstof (O₂)**-objecten | Aanwezige datapunten met het opgeloste zuurstof, om het voeren te blokkeren wanneer dit te laag zakt. **Per schakelaar** toegewezen. |
| *(optioneel)* Een **Telegram**-instantie | De officiële `telegram`-adapter, ingericht en gestart, als je push-meldingen wilt. |
| Internettoegang op de ioBroker-host | Alleen voor adres zoeken/kaart in de configuratie. Het normale gebruik werkt offline. |

---

## 3. Installatie

1. In de ioBroker-**admin** het tabblad **Adapter** openen.
2. In de lijst met adapters **automatic-feeder** opzoeken en op **Installeren** klikken.
3. Een **instantie** van de adapter aanmaken.
4. De instantie-instellingen openen (tandwiel-symbool) – er zou de configuratiepagina met het
   tabblad **Basisinstellingen** moeten verschijnen. Blijft deze leeg, zie [Probleemoplossing](#9-probleemoplossing--faq).

---

## 4. Snelstart – de eerste voedering

Doel: Een schakelaar moet – meteen, ter test – 5 seconden lang voeren.

1. **Instellingen openen** van de automatic-feeder-instantie.
2. Op het tabblad **Basisinstellingen**:
   * Onder **Locatie** *Systeeminstellingen voor alle schakelaars gebruiken* geselecteerd laten
     (alleen relevant als je later het astronomische venster inschakelt). Je kunt ook een gedeelde
     locatie kiezen of deze per schakelaar configureren.
   * Naar beneden scrollen naar **Schakelaars** en **Schakelaar toevoegen** klikken.
   * Een **naam** toekennen (bijv. `Koi-vijver`). Deze naam wordt de titel van een eigen tabblad.
   * Naast **Schakelaar-object** het lijst-symbool aanklikken en het datapunt kiezen dat jouw
     automaat schakelt (bijv. jouw stopcontact). De schakelaar moet **actief** zijn (vinkje links).
3. **Opslaan** (diskette/vinkje onderaan). Een nieuw tabblad met jouw schakelaarnaam verschijnt.
4. Dit **schakelaar-tabblad** openen. Helemaal bovenaan onder **Handmatige voedering** een duur instellen
   (bijv. `5` seconden) en **Nu voeren** klikken. De uitgang zou 5 seconden moeten inschakelen en
   dan weer uitschakelen.
5. In hetzelfde tabblad het echte schema onder **Voederschema** inrichten (bijv. vaste tijden
   08:00 en 18:00) en de **voederduur** onder **Voederproces** instellen, dan
   **Opslaan**.

Klaar – vanaf nu voert de adapter automatisch. Al het overige legt de opties in detail uit.

---

## 5. De instellingenpagina in detail

De configuratie heeft een tabblad **Basisinstellingen** evenals **een tabblad per schakelaar** (wordt
automatisch aangemaakt zodra een schakelaar een naam heeft). Als een pagina niet scrolt, het
venster vergroten of de scrollbalk rechts gebruiken – alle secties zijn bereikbaar.

### 5.1 Tabblad „Basisinstellingen"

#### Locatie (voor het astronomische venster)

De locatie wordt gebruikt om zonsop-/-ondergang te berekenen voor het **astronomische voedervenster**
dat per schakelaar kan worden ingeschakeld (zie *Beperkingen* in het schakelaar-tabblad). Ze is alleen
nodig als ten minste één schakelaar dat venster gebruikt. Drie mogelijkheden:

* **Systeeminstellingen voor alle schakelaars gebruiken** – neemt breedte-/lengtegraad uit de
  ioBroker-systeemconfiguratie (aanbevolen wanneer daar al ingesteld). De huidige waarden worden
  weergegeven.
* **Één gedeelde locatie voor alle schakelaars** – één enkele positie instellen die alle schakelaars
  gebruiken:
  * Een **adres** invoeren en **Zoeken** drukken. De adapter lost het op (via
    OpenStreetMap / Nominatim) en plaatst een marker.
  * Of **op de kaart klikken** / de **marker slepen** om de exacte plek te kiezen.
  * Breedte-/lengtegraad kunnen ook direct worden ingevoerd; de kaart volgt.
* **De locatie individueel per schakelaar configureren** – elke schakelaar bepaalt zijn eigen locatie
  op zijn eigen tabblad (handig wanneer voederstations, bijv. vijvers, op verschillende plekken staan).

> Het adres zoeken loopt in de adapter-backend, daarom moet de **instantie draaien**. Kaart en zoeken
> hebben internettoegang nodig.

De **offsets voor zonsop-/-ondergang worden per schakelaar geconfigureerd** (onder *Beperkingen*),
en de berekende tijden worden per schakelaar gepubliceerd als `status.sunrise` / `status.sunset`,
elke nacht automatisch opnieuw berekend.

#### Schakelaars

De lijst met voederautomaten (tot 5). Per item:

* **Actief** (vinkje) – alleen actieve schakelaars worden ingepland.
* **Naam** – vrije tekst; wordt de tabblad-titel van de schakelaar en de kanaalnaam in de objectboom.
* **Schakelaar-object** – het aanwezige ioBroker-datapunt dat wordt aangestuurd. Via het
  lijst-symbool selecteren, via het kruis leegmaken.

Met **Schakelaar toevoegen** maak je er nog een aan (max. 5), met het prullenbak-symbool
verwijder je er een. Bij het verwijderen worden ook diens datapunten gewist.

* **Deze schakelaar gebruikt de Automatic-Feeder relaisprint (voegt een relaistabblad toe)**
  (aan/uit-schakelaar) – schakel dit alleen in voor een schakelaar waarvan het voederstation de
  optionele Automatic-Feeder relaisprint (ESP32) gebruikt. Wanneer ingeschakeld krijgt díe
  schakelaar een extra **Relais**-tabblad (zie sectie 5.3).

### 5.2 Schakelaar-tabbladen

Elke geconfigureerde schakelaar krijgt een eigen tabblad met zijn naam. Het bevat de volgende
secties.

#### Handmatige voedering

* **Duur van de handmatige voedering (seconden)** – de door de knop gebruikte duur.
* **Nu voeren** – activeert meteen een voedering met deze duur. Handig om te testen of
  voor een extra portie. (Of blokkeringen worden genegeerd, hangt af van *Handmatige trigger negeert
  alle blokkeringen* onder *Beperkingen*.)
* Voor de knop moet de instantie draaien en de configuratie **opgeslagen** zijn.

#### Voederschema

**Eén** modus kiezen:

* **Vaste tijden** – een lijst met tijdstippen (`HH:mm`). Willekeurig veel toevoegen; de automaat
  loopt dagelijks op elk daarvan. Voorbeeld: `08:00` en `18:00`.
* **Interval binnen een periode** – herhaald binnen een venster voeren:
  * **Begin periode** / **Einde periode** – bijv. 08:00 tot 18:00.
  * **Interval (minuten)** – bijv. 60 → voert dagelijks om 08:00, 09:00, … tot het einde van het venster.

Als het **astronomische venster** is ingeschakeld (zie *Beperkingen*), worden het vaste begin/einde
van het venster vervangen door het venster zonsopgang/zonsondergang en verborgen; het interval loopt
dan tussen zonsopgang en zonsondergang. De volgende geplande tijd staat op elk moment in het datapunt
`status.nextFeeding`.

#### Voederproces

* **Voederduur (seconden)** – hoe lang de uitgang bij een geplande voedering AAN blijft.
* **Aan-waarde** / **Uit-waarde** – de waarden die naar het schakelaar-object worden geschreven.
  Standaard zijn `true` en `false`, wat bij de meeste stopcontacten/relais past. Verwacht jouw
  apparaat getallen of tekst, hier bijv. `1` / `0` of `ON` / `OFF` invoeren.

#### Temperatuur- & zuurstofbronnen

Elke schakelaar (voederstation) heeft **zijn eigen** sensoren – verschillende vijvers/bassins kunnen verschillende objecten gebruiken:

* **Luchttemperatuur** – vinkje zetten en het datapunt kiezen dat de luchttemperatuur van dit station bevat.
* **Watertemperatuur** – vinkje zetten en het datapunt kiezen dat de watertemperatuur van dit station bevat.
  Dit is de primaire sensor van de **voederzone** (plaats hem waar de vissen daadwerkelijk voeren, niet aan het oppervlak).
* **Watertemperatuur (diep)** – *optionele tweede* watersensor (bijv. bij de bodem). Wordt pas weergegeven zodra
  de primaire watersensor is ingeschakeld. Met twee sensoren kies je een **combinatiemodus** voor dynamisch voeren:
  *Voederzone (alleen ondiep)* [standaard], *Gemiddelde van beide*, *Koudste laag* of *Seizoensgebonden* (gebruikt de
  ondiepe sensor zolang die op of boven een drempel ligt, anders de diepe sensor). De temperatuur**blokkering**
  gebruikt altijd de **koudste** van de twee lagen. Een tweede sensor helpt alleen in **diepe, niet-gemengde vijvers**
  (een draaiende pomp mengt het water en heft elke gelaagdheid op) — zie *Dynamisch voeren — achtergrond & bronnen*.
* **Zuurstof (O₂)** – vinkje zetten en het datapunt kiezen dat het opgeloste zuurstof bevat.

Alleen getal-datapunten zijn zinvol. De huidige waarden worden naar de datapunten `status.airTemperature`,
`status.waterTemperature`, `status.waterTemperatureDeep`, `status.oxygen` (en `status.waterStratification`
= ondiep − diep) van deze schakelaar gespiegeld. De drempels worden hieronder ingesteld (*Temperatuurblokkering*),
en de temperaturen sturen ook het *Dynamisch voeren* aan.

#### Temperatuurblokkering

Wordt alleen weergegeven voor de hierboven geactiveerde temperatuurbronnen (*Temperatuur- & zuurstofbronnen*). Per schakelaar:

* **Blokkeren op watertemperatuur** – *Blokkeren wanneer onder* en/of *Blokkeren wanneer boven* (°C).
* **Blokkeren op luchttemperatuur** – hetzelfde voor de lucht.

Ligt de huidige temperatuur buiten het toegestane bereik, dan wordt de voedering overgeslagen
en de reden in `status.blockReason` geschreven. (Is een temperatuurwaarde onbekend, dan blokkeert deze
bron niet.)

#### Beperkingen

* **Voeren beperken tot het astronomische dagvenster (zonsop-/-ondergang + offsets)** – indien aan
  wordt het voeren beperkt tot het dagvenster dat wordt berekend uit de locatie van deze schakelaar.
  Voor *Interval* en *Dynamisch voeren* vervangt dit venster het vaste begin/einde van het venster;
  voor *Vaste tijden* werkt het als een dag-/nachtbewaking (tijden buiten het venster worden
  overgeslagen). Indien ingeschakeld kun je instellen:
  * **Minuten na zonsopgang** – begin zoveel minuten *na* zonsopgang (standaard 0).
  * **Minuten voor zonsondergang** – stop zoveel minuten *voor* zonsondergang (standaard 0).
  * **Locatie voor deze schakelaar** – alleen weergegeven wanneer de algemene *Locatie* op
    *individueel* staat: kies *Systeeminstellingen gebruiken* of *Specifieke locatie vastleggen*
    (adres zoeken + kaart) voor deze schakelaar. De berekende tijden verschijnen in
    `status.sunrise` / `status.sunset`.
* **Handmatige trigger negeert alle blokkeringen** – wanneer actief, voeren de knop en de
  datapunten `feedNow` / `feedFor` ook bij actieve temperatuur-/vensterblokkering.

#### Dynamisch voeren

Optioneel: past het **voederinterval en de duur aan de temperatuur** aan via het Q10-model (het metabolisme verdubbelt ongeveer per +10 °C). Vereist een actieve temperatuurbron; vaste tijden worden dan vervangen door een interval binnen het venster.

* **Inschakelen / bron** – schakel in en kies water- of luchttemperatuur. Wanneer een tweede (diepe) watersensor is geconfigureerd, wordt de hier gebruikte watertemperatuur uit beide lagen gecombineerd volgens de gekozen combinatiemodus (zie *Temperatuur- & zuurstofbronnen*).
* **Referentie / Q10** – het basisinterval en de duur gelden bij de referentietemperatuur (bijv. 20 °C); Q10 meestal 2–2,5 (het metabolisme verdubbelt ongeveer per +10 °C — zie *Dynamisch voeren — achtergrond & bronnen*).
* **Interval / duur (basis, min, max)** – grenzen voor het berekende interval (minuten) en de duur (seconden). Het **basisinterval en het max-interval moeten groter dan 0 zijn**, anders kan er geen voedering worden gepland.
* **Middelingsvenster / hysterese** – een voortschrijdend gemiddelde (bijv. 24 u) vlakt pieken af; hysterese voorkomt herplannen bij kleine wijzigingen.

De huidige waarden staan in `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` en `status.dynamicDurationSec`. Een optionele **zuurstofbron (O₂)** kan het voeren blokkeren wanneer het opgeloste zuurstof onder een drempel zakt. De winterpauze heeft voorrang op dynamisch voeren.

> Als dynamisch voeren is ingeschakeld maar er geen geldig interval kan worden berekend (basis- of max-interval is 0, of een ongeldig tijdvenster), wordt er niets ingepland: `status.nextFeeding` blijft leeg en `status.blockReason` toont een aanwijzing. Stel een basisinterval en een max-interval groter dan 0 in.

#### Winterpauze

Per schakelaar kun je een terugkerende **winterpauze** instellen (seizoensgebonden, als `MM-DD`-data die zich jaarlijks herhalen en over de jaarwisseling kunnen lopen).

* **Winterpauze inschakelen** – de pauze inschakelen.
* **Winterbegin / Wintereinde** – kies dag en maand uit een kalender (weergegeven als dd.mm), bijv. 01.11 tot 15.03.
* **Modus** – tijdens de pauze **voeding onderbreken**, voeden met een **beperkt** eigen interval of **één keer per dag** op een vast tijdstip; er geldt een eigen **wintervoederduur**.
* **Herinneringen (Telegram)** – in de dagen vóór het begin en vóór het einde wordt dagelijks (voor het laatst op de dag zelf) op het ingestelde uur een herinnering verzonden. Vereist een Telegram-instantie (zie hieronder).

De huidige status staat in het datapunt `status.winterActive`. Na afloop van de pauze start de voeding automatisch weer.

#### Voederpauzes

**Voeding nu opschorten (hoofdschakelaar).** Bovenaan deze sectie schort een enkele **aan/uit-schakelaar** onmiddellijk en voor onbepaalde tijd **alle** voedering voor de schakelaar op — hij heeft voorrang op de onderstaande tijdgebonden pauzes **en** op elke voedingsmodus (vaste tijden, interval, dynamisch voeren, winterpauze). Zet hem weer **uit** en het voeren wordt precies zo hervat als voorheen ingesteld; er hoeft verder niets te worden gewijzigd. Bij het omschakelen wordt een **Telegram**-bericht verzonden (*aan* / *uit*). Typisch gebruik: een spontane onderbreking (medicatie, onderhoud, waterbehandeling) zonder aan een schema te raken. Hij is bewerkbaar vanaf de instellingenpagina **en vanuit VIS/scripts** via `settings.pauseNow`, en zijn actuele status staat in `status.pauseManual`.

Onder de hoofdschakelaar kun je met tot **3 eenmalige voederpauzes** per schakelaar absolute datum-tijd-perioden plannen waarin het voeren **volledig wordt opgeschort** (hogere prioriteit dan elke voedingsmodus). Typisch gebruik: een **quarantaine na het bijzetten**, wanneer nieuwe vissen een tijdje niet gevoerd mogen worden.

* **Pauze 1 / 2 / 3** – aankruisen om in te schakelen, dan een **Start** en **Einde** kiezen (datum + tijd, weergegeven als `DD.MM.YYYY HH:mm`), bijv. `15.07.2026 08:00` tot `22.07.2026 18:00`.
* Het voeren stopt zolang *nu* binnen een ingeschakelde pauze valt en start automatisch weer aan het einde ervan.
* Een **Telegram**-bericht wordt precies aan het **begin** en **einde** van elke pauze verzonden (vereist een Telegram-instantie, zie hieronder). Start de adapter terwijl een pauze al actief is, dan wordt alleen het *einde*-bericht verzonden.
* Bewerkbaar vanaf de instellingenpagina **en vanuit VIS/scripts** via de `settings.*`-datapunten (bijv. `settings.pause1Start`).

De huidige status staat in `status.pauseActive` en `status.pauseActiveUntil` (de hoofdschakelaar stuurt ook `status.pauseActive` aan).

#### Schakelbewaking

Na het schakelen kan de adapter controleren of de schakelaar de in- en uit-toestand
**daadwerkelijk** heeft bereikt, en meldt per voedering een van drie resultaten:

| Resultaat | Betekenis | Melding |
|----------|-----------|---------|
| ✅ Succes | Schakelaar heeft zoals verwacht in- en uitgeschakeld | „Voeding geactiveerd voor x s." |
| ❌ Inschakelen mislukt | de schakelaar heeft de AAN-toestand nooit bevestigd | „Voeding kon niet worden uitgevoerd. Controleer de schakelaar!" |
| ❌ Uitschakelen mislukt | hij ging aan, maar schakelde niet weer uit | „Storing: de voederautomaat is niet uitgeschakeld!" |

> Het bericht wordt verzonden in de ingestelde ioBroker-systeemtaal (standaard Engels).


* **Controleren of de schakelaar daadwerkelijk in- en uitschakelt** – activeert de bewaking.
* **Bewakings-timeout (seconden)** – hoe lang op de bevestiging wordt gewacht.
* **Verificatiepogingen** – hoeveel gespreide hercontroles worden uitgevoerd voordat een storing wordt gemeld (standaard 3). Elke poging leest ook de huidige toestand terug, zodat vertraagde terugmelding (bijv. Homematic-radio) geen valse storing meer veroorzaakt.

> **Belangrijk:** De bewaking werkt alleen wanneer de schakelaar zijn **werkelijke toestand
> terugmeldt**, d.w.z. het doelobject wordt met `ack=true` bijgewerkt (typisch voor
> stopcontacten/relais met statusterugmelding). Een eenvoudige hulp-boolean die niemand bevestigt,
> zou altijd een storing melden – schakel dan de bewaking voor deze schakelaar uit.

Het resultaat staat bovendien in de datapunten `status.lastResult` (tekst) en `status.error` (boolean),
zodat je erop kunt reageren (bijv. een eigen melding activeren).

#### Telegram-meldingen

Verzendt de meldingen van de schakelbewaking naar Telegram – **per schakelaar** geconfigureerd:

* **Telegram-instantie** – een van de geïnstalleerde `telegram.*`-instanties kiezen (of *Geen*, om
  Telegram voor deze schakelaar uit te schakelen). Is er geen geïnstalleerd, dan wijst het veld erop.
* **Telegram-ontvanger (optioneel)** – een bepaalde gebruikers-/chat-naam, zoals in de telegram-adapter
  geconfigureerd; leeg laten om naar alle geconfigureerde ontvangers te verzenden.
* **Selectievakjes** – kiezen welke meldingen worden verzonden: succesvolle voedering, niet
  uitvoerbaar en/of storing van het uitschakelen.

De **winterpauze-herinneringen** (indien ingeschakeld, zie *Winterpauze*) worden naar dezelfde
Telegram-instantie verzonden, onafhankelijk van deze bewakings-selectievakjes.

De volledige inrichting staat onder [Telegram-meldingen](#8-telegram-meldingen).

### 5.3 Relaisprint-tabblad (optioneel)

Dit tabblad verschijnt alleen wanneer de per-schakelaar-optie **Deze schakelaar gebruikt de
Automatic-Feeder relaisprint …** van deze schakelaar in de algemene instellingen is ingeschakeld
(zie sectie 5.1).
Eén relaisprint hoort bij één schakelaar (voederstation). De print is een ESP32 met drie
timerknoppen (S1–S3) en een eigen webinterface, bereikbaar via je netwerk op **poort 80**. De
adapter **configureert** de print alleen en **toont zijn status** – hij triggert geen voedering via
de print (de knoppen worden op de print zelf bediend).

* **Printadres (IP of mDNS-host)** – bijv. `192.168.1.50` of `feeder.local`. Een vast IP is het
  betrouwbaarst; mDNS (`.local`) werkt alleen als je hostsysteem het kan omzetten. Een
  `:port`-achtervoegsel is toegestaan maar meestal niet nodig (standaard `80`).
* **Verbinding testen & tijden ophalen** – neemt eenmalig contact op met de print. Een groene
  *Verbonden*-chip en de host/IP/firmware van de print bevestigen een werkende verbinding; de drie
  knopvoedertijden worden dan uit de print in de onderstaande velden gelezen. Een rode *Niet
  verbonden*-chip toont de fout.
* **Knopvoedertijden (seconden)** – de voedertijd van elke knop **S1**, **S2** en **S3** (1–600 s).
  Omdat deze **ook bewerkbaar zijn op de eigen webinterface van de print**, haal ze altijd eerst
  *op* en pas ze daarna aan.
* **Tijden opslaan naar print** – schrijft de drie waarden naar de print.
* **Print herstarten** – herstart de ESP32 via zijn API (`POST /api/reboot`). Na een
  bevestigingsvraag start de print opnieuw op en is enkele seconden offline, waarna hij
  automatisch weer terugkomt.

Onderaan het tabblad toont een **Systeemoverzicht** na een geslaagde verbindingstest (de knop
*Verbinding testen & tijden ophalen*) de live systeemgegevens van de print: firmwareversie,
hostnaam, IP-adres, wifi-netwerk, signaalsterkte (dBm), MAC-adres, uptime, vrij geheugen en de
laatste resetreden.

De verbinding wordt ook in de objectboom gespiegeld en elke 60 s ververst – zie de
`relay.*`-datapunten in sectie 6.

---

## 6. Objecten / datapunten

> **Let op:** alle datapunten met tijdstempel worden weergegeven in de **lokale tijdzone van het systeem** (formaat `DD.MM.JJJJ UU:MM:SS`, bijv. `01.07.2026 16:20:00`). Voor VIS en scripts heeft elk tijdstempel bovendien een **numerieke tweeling** die eindigt op `…Ts` (Unix-tijd in **milliseconden**, `0` = geen) — ideaal voor countdowns en tijdbalken zonder string-parsing, en onafhankelijk van het weergaveformaat.

De adapter legt de volgende datapunten in zijn namespace aan
(`automatic-feeder.<instanz>.`).

**Globaal**

| Datapunt | Type | Betekenis |
|------------|-----|-----------|
| `info.connection` | boolean (ro) | Adapter draait en de configuratie is geldig. |

**Per schakelaar onder `switches.<id>.`** (`<id>` is een interne ID zoals `sw-0`)

Direct onder de schakelaar bevinden zich de handmatige trigger en twee subkanalen:

* **`status`** (`switches.<id>.status.*`) – de alleen-lezen statusdatapunten die hieronder staan.
* **`settings`** (`switches.<id>.settings.*`) – een **bewerkbare** spiegel van de configuratie
  van deze schakelaar. Als je daar een nieuwe waarde schrijft (vanuit VIS of een script), wijzig
  je de configuratie en wordt de instantie opnieuw gestart zodat de wijziging van kracht wordt.
  Enkele afgeleide velden zijn alleen-lezen (bijv. `winterWindow`).
* **`relay`** (`switches.<id>.relay.*`) – alleen aanwezig wanneer deze schakelaar een relaisprint
  gebruikt; de alleen-lezen statusdatapunten van de relaisprint die aan het einde van de tabel
  staan.

| Datapunt | Type | Betekenis |
|------------|-----|-----------|
| `feedNow` | boolean (rw) | `true` schrijven om handmatig te voeren. |
| `feedFor` | number (rw) | Schrijf een duur in **seconden** om **één voedering met precies die duur** te activeren — geen configuratiewijziging, geen herstart. Wordt na uitvoering teruggezet naar `0`. |
| `status.feedingActive` | boolean (ro) | Er loopt nu een voedering. |
| `status.feedingEndsTs` | number (ro) | Einde van de **lopende** voedering als Unix-tijd in ms (`0` = niet aan het voeren) — voor een live looptijd-aftelling (bijv. 15 → 0 s) in VIS. |
| `status.feedingDurationSec` | number (ro) | Totale duur van de **lopende** voedering in seconden (`0` = geen voedering) — zodat een VIS-widget een exacte voortgangsring naast de aftelling kan tekenen. |
| `status.lastFeeding` | string (ro) | Tijdstip van de laatste voedering. |
| `status.lastFeedingTs` | number (ro) | Laatste voedering als Unix-tijd in ms (`0` = nog geen). |
| `status.nextFeeding` | string (ro) | Tijdstip van de volgende geplande voedering. |
| `status.nextFeedingTs` | number (ro) | Volgende geplande voedering als Unix-tijd in ms (`0` = niets gepland). |
| `status.blocked` | boolean (ro) | De laatste poging was geblokkeerd. |
| `status.blockReason` | string (ro) | Reden van de blokkering (nacht / temperatuur / zuurstof), in de systeemtaal. |
| `status.blockReasonCode` | string (ro) | De blokkeringsreden als **stabiele machineleesbare code** (bijv. `blockNight`, `blockWaterBelow`, `blockPauseManual`; leeg = niet geblokkeerd) — voor icoon-/kleurlogica in VIS, onafhankelijk van de taal. |
| `status.lastResult` | string (ro) | Resultaattekst van de laatste voederpoging. |
| `status.error` | boolean (ro) | De laatste poging had een schakelstoring. |
| `status.winterActive` | boolean (ro) | De winterpauze is momenteel actief. |
| `status.winterLastStartReminder` | string (ro) | Datum van de laatst verzonden „winter begint"-herinnering. |
| `status.winterLastEndReminder` | string (ro) | Datum van de laatst verzonden „winter eindigt"-herinnering. |
| `status.pauseManual` | boolean (ro) | De handmatige hoofdpauze (*Voeding nu opschorten* / `settings.pauseNow`) is ingeschakeld. |
| `status.pauseActive` | boolean (ro) | Er is momenteel een eenmalige voederpauze actief. |
| `status.pauseActiveUntil` | string (ro) | Einde van de momenteel actieve voederpauze (leeg indien geen). |
| `status.pauseActiveUntilTs` | number (ro) | Einde van de actieve voederpauze als Unix-tijd in ms (`0` = geen). |
| `status.dynamicAvgTemperature` | number (ro) | Gemiddelde temperatuur die door dynamisch voeren wordt gebruikt. |
| `status.dynamicRate` | number (ro) | Q10-factor die momenteel door dynamisch voeren wordt toegepast. |
| `status.dynamicIntervalMin` | number (ro) | Momenteel berekend dynamisch interval (minuten). |
| `status.dynamicDurationSec` | number (ro) | Momenteel berekende dynamische duur (seconden). |
| `status.airTemperature` | number (ro) | Eigen luchttemperatuur-bronwaarde van deze schakelaar. |
| `status.waterTemperature` | number (ro) | Eigen watertemperatuur-bronwaarde van deze schakelaar (voederzone- / ondiepe sensor). |
| `status.waterTemperatureDeep` | number (ro) | Optionele diepe watertemperatuursensorwaarde van deze schakelaar. |
| `status.waterStratification` | number (ro) | Temperatuurverschil ondiep − diep (alleen met twee watersensoren). |
| `status.oxygen` | number (ro) | Eigen opgeloste-zuurstof-bronwaarde van deze schakelaar. |
| `status.sunrise` / `status.sunset` | string (ro) | Berekende zonsop-/-ondergang voor de locatie van deze schakelaar (astronomisch venster). |
| `status.sunriseTs` / `status.sunsetTs` | number (ro) | Zonsop-/-ondergang als Unix-tijd in ms — bijv. voor een dagvoortgangsbalk in VIS. |
| `relay.connected` | boolean (ro) | De voor deze schakelaar geconfigureerde relaisprint is bereikbaar (alleen wanneer deze schakelaar een relaisprint gebruikt). |
| `relay.info` | string (ro) | Identiteit van de relaisprint (host / IP / firmware) uit de laatste geslaagde peiling. |
| `relay.active` | boolean (ro) | De timer van de relaisprint loopt momenteel. |
| `relay.remaining` | number (ro) | Resterende seconden op de lopende timer van de relaisprint. |

Deze datapunten kunnen in VIS, scripts of andere adapters worden gebruikt – bijv. `status.nextFeeding`
op een dashboard weergeven of bij `status.error = true` een eigen alarm activeren.

---

## 7. Voorbeelden / recepten

**Koi-vijver, tweemaal daags, alleen bij voldoende warmte**
* Modus *Vaste tijden* → `08:00`, `18:00`; duur `6` s.
* In het schakelaar-tabblad, onder *Temperatuur- & zuurstofbronnen*, *Watertemperatuur* activeren
  en de sensor kiezen; dan *Blokkeren op watertemperatuur* → *Blokkeren wanneer onder* `8` °C (geen voedering bij te koud water).
* Onder *Beperkingen* *Voeren beperken tot het astronomische dagvenster* inschakelen, zodat er na
  donker niets wordt gevoerd.

**Volière, alleen overdag (astronomisch venster)**
* Modus *Interval binnen een periode* → interval `90` min; duur `3` s.
* Onder *Beperkingen* het astronomische venster inschakelen met offsets `30` / `30` min → er wordt
  gevoerd van 30 min na zonsopgang tot 30 min voor zonsondergang, automatisch de seizoenen volgend.

**Koi-vijver, temperatuurafhankelijk (dynamisch voeren)**
* In het schakelaar-tabblad, onder *Temperatuur- & zuurstofbronnen*, *Watertemperatuur* activeren en de sensor kiezen.
* Dan *Dynamisch voeren* openen, inschakelen, bron *Watertemperatuur*.
* Referentie `20` °C, Q10 `2,2`, basisinterval `60` min (min `30`, max `480`), basisduur `5` s
  (min `2`, max `15`). Er wordt dan bij warmte vaker en iets meer gevoerd, en bij kou minder.

**Winterpauze voor de vijver**
* In het schakelaar-tabblad *Winterpauze* openen, inschakelen, *Winterbegin* `01.11` en *Wintereinde*
  `15.03` instellen, modus *Voeding onderbreken*.
* Optioneel de herinneringen aankruisen, zodat je een paar dagen vóór begin/einde een Telegram-bericht krijgt.

**Quarantaine na het bijzetten (voederpauze)**
* In het schakelaar-tabblad *Voederpauzes* openen, *Pauze 1* aankruisen en *Start* `15.07.2026 08:00`,
  *Einde* `22.07.2026 18:00` instellen → in dat venster wordt helemaal niet gevoerd, daarna start het automatisch weer.
* Met een geconfigureerde Telegram-instantie krijg je een bericht aan het begin en het einde van de pauze.

**Nu meteen de voeding opschorten (hoofdschakelaar)**
* In het schakelaar-tabblad *Voederpauzes* openen en *Voeding nu opschorten* inschakelen – of `true`
  schrijven naar `automatic-feeder.0.switches.sw-0.settings.pauseNow` vanuit een VIS-schakelaar.
* Alle voedering stopt onmiddellijk (met voorrang op elke modus) totdat je hem weer uitschakelt; elke
  omschakeling verzendt een Telegram-bericht. `status.pauseManual` toont de actuele status.

**Handmatige extra portie via VIS-knop**
* In VIS een knop aanmaken die `true` op `automatic-feeder.0.switches.sw-0.feedNow` schrijft.
* Of gebruik een schuifregelaar/getalveld dat de **seconden** naar
  `automatic-feeder.0.switches.sw-0.feedFor` schrijft → voert **één keer met precies die duur**
  (geen configuratiewijziging, geen herstart; het datapunt wordt daarna teruggezet naar `0`).
* Optioneel *Handmatige trigger negeert alle blokkeringen* activeren, zodat er altijd wordt gevoerd.

---

## 8. Telegram-meldingen

1. De **telegram**-adapter installeren en inrichten (bot met @BotFather aanmaken, token
   invoeren, chat met de bot starten). De Telegram-instantie moet **draaien**.
2. In een automatic-feeder-**schakelaar-tabblad** de sectie **Telegram-meldingen** openen:
   * De **Telegram-instantie** in de dropdown selecteren (bijv. `telegram.0`).
   * Optioneel een **ontvanger** invoeren (de in de telegram-adapter weergegeven gebruikers-/chat-naam);
     leeg laten om iedereen te informeren.
   * De gewenste meldingen aankruisen: *succesvolle voedering*, *niet uitvoerbaar*,
     *storing uitschakelen*.
3. Opslaan. Vanaf nu worden de gekozen bewakings-resultaten naar Telegram verzonden (met de
   schakelaarnaam ervoor). Voorwaarde is dat de *schakelbewaking* voor deze schakelaar
   geactiveerd is.
4. De **winterpauze-herinneringen** gebruiken dezelfde Telegram-instantie en ontvanger. Ze worden
   in de sectie *Winterpauze* ingesteld (dagen vóór begin/einde en het herinneringsuur) en
   vereisen **niet** dat de bewaking is ingeschakeld.

---

## 9. Probleemoplossing & FAQ

**De instellingenpagina is leeg / wit.**
De browser met **Strg+Shift+R** opnieuw laden. Blijft het probleem bestaan, de instantie
opnieuw starten en de instellingen opnieuw openen.

**Het nieuwe icoon / een wijziging verschijnt niet.**
Browser-cache. Hard opnieuw laden met **Strg+Shift+R**.

**Er wordt helemaal niet gevoerd.**
Op volgorde controleren: schakelaar **Actief**; een **schakelaar-object** geselecteerd; **schema**
geldig (`status.nextFeeding` toont een tijd); niet **geblokkeerd** (`status.blocked` / `status.blockReason` bekijken);
het **astronomische venster** sluit de tijd niet uit; het **log-level** van de instantie op `debug`
zetten en het log volgen.

**Er wordt nooit 's nachts gevoerd, hoewel ik dat wil.**
*Voeren beperken tot het astronomische dagvenster* voor deze schakelaar deactiveren of de
offsets voor zonsop-/-ondergang aanpassen. Is het astronomische venster ingeschakeld maar heeft de
schakelaar geen geldige coördinaten, dan blijft de vensterbewaking inactief en wordt een waarschuwing
gelogd.

**De bewaking meldt altijd een storing.**
Jouw schakelaar-object meldt vermoedelijk zijn werkelijke toestand niet terug (`ack=true`). Ofwel
een schakelaar met statusterugmelding gebruiken of de *schakelbewaking* voor deze schakelaar
deactiveren.

**Dynamisch voeren verandert niets.**
Zorg ervoor dat de gekozen temperatuurbron (water of lucht) in het schakelaar-tabblad
(*Temperatuur- & zuurstofbronnen*) geactiveerd is en waarden levert. Direct na een herstart wordt het voortschrijdend gemiddelde nog opgebouwd,
dus start het vanaf de basiswaarden. Bekijk `status.dynamicAvgTemperature` en `status.dynamicIntervalMin`.

**Dynamisch voeren is ingeschakeld maar er wordt nooit gevoerd (`status.nextFeeding` is leeg).**
Het **basisinterval of het max-interval is 0** (of het tijdvenster is ongeldig), zodat er geen interval kan worden berekend – `status.blockReason` toont dan een aanwijzing. Stel een basisinterval en een max-interval groter dan 0 in (en een geldig venster). Let op: als je *zowel* het min- als het max-interval op 0 laat staan, wordt het resultaat ook naar 0 gedwongen.

**Er wordt niet gevoerd hoewel het geen winter is (of er wordt gevoerd hoewel het zou moeten pauzeren).**
Controleer de *Winterpauze*-data (`Winterbegin` / `Wintereinde`, formaat dd.mm) en de modus. Het
datapunt `status.winterActive` geeft aan of de pauze momenteel actief is.

**Het adres zoeken zegt dat de instantie moet draaien.**
De automatic-feeder-instantie starten – de geocoding loopt in de backend.

**Telegram-berichten komen niet aan.**
Is er in het schakelaar-tabblad een Telegram-instantie geselecteerd? Is de telegram-adapter ingericht en
gestart? Is ten minste één meldingssoort aangekruist en de *schakelbewaking* geactiveerd?

---

## 10. Logging & foutopsporing

De adapter logt op de gebruikelijke ioBroker-niveaus. Voor gedetailleerde meldingen het log-level van de
instantie (Instanties → automatic-feeder.x → log-level) op **debug** of **silly** verhogen:

* **error** – fouten die aandacht nodig hebben (bijv. schrijven naar de schakelaar
  mislukt).
* **warn** – verkeerde configuratie (geen coördinaten, ongeldig schema …).
* **info** – mijlpalen (start, een voedering uitgevoerd of geblokkeerd, handmatige trigger).
* **debug** – gedetailleerd verloop (planningsbeslissingen, temperatuur-updates, geocoding,
  aan-/uit-waarden, verificatie bevestigd/timeout).
* **silly** – zeer uitgebreide tracing (elke timer, elke blokkeringscontrole, elke toestandswijziging).

---

## 11. Dynamisch voeren — achtergrond & bronnen

Vissen (koi, goudvissen, vijverkarpers) zijn **poikilotherm (ectotherm)**: hun metabolisme volgt de
watertemperatuur. Als vuistregel **verdubbelt** de stofwisselingssnelheid ongeveer **per +10 °C**, wat
precies de **Q10-coëfficiënt** (meestal 2–3) is die deze adapter gebruikt — dus bij warmte vaker en iets
meer voeren, en bij kou minder, is fysiologisch verantwoord.

**Praktische temperatuurrichtlijn (koi/vijvervissen):**

* **onder ~4–5 °C** – niet voeren (gebruik de *Winterpauze*).
* **~4–10 °C** – nauwelijks actief; zelden of niet voeren, licht verteerbaar (tarwekiem-)voer.
* **~10–15 °C** – verminderd voeren; het immuunsysteem is nog zwak (~12 °C).
* **~15–25 °C** – optimaal groeibereik, volledige voeding.
* **boven ~28 °C** – het opgeloste **zuurstof** wordt de beperkende factor → de O₂-blokkering is hier nuttig.

**Waar meten, en waarom een tweede sensor:** de temperatuur die telt is het water waarin de vissen zich
daadwerkelijk bevinden (de **voederzone**), *niet* het oppervlak (dat enkele graden kan afwijken). In een
vijver die door een draaiende pomp wordt gemengd, of een ondiepe vijver, volstaat één goed geplaatste sensor.
Alleen in een **diepe, niet-gemengde vijver** treedt gelaagdheid van het water op: boven 4 °C ligt het warme
water bovenop (kouder eronder); onder 4 °C keert dit om, waardoor bij de bodem een refugium van ~4 °C
overblijft. Daar voegt een **tweede (diepe) sensor** waarde toe — voor de veiligheid (voeren op basis van de
koudste laag), voor een seizoensgebonden ondiep/diep-omschakeling en om de gelaagdheid zichtbaar te maken
(`status.waterStratification`). Voor de meeste vijvers is hij optioneel.

**Bronnen / verder lezen:**

* Volkoff H. & Rønnestad I. (2020): *Effects of temperature on feeding and digestive processes in fish.* Temperature 7(4):307–320. <https://pubmed.ncbi.nlm.nih.gov/33251280/>
* K.O.I. – *Water Temperature and Koi.* <https://koiorganisationinternational.org/koi-articles/water-temperature-and-koi>
* K.O.I. – *The Science behind Cold Water in Koi Ponds.* <https://koiorganisationinternational.org/koi-articles/science-behind-cold-water-koi-ponds>
* Pond Informer – *Koi feeding guide.* <https://pondinformer.com/koi-feeding-guide/>

> Deze waarden zijn algemene richtlijnen voor koi/vijvervissen, geen vervanging voor het observeren van je
> eigen dieren. Pas de referentietemperatuur, Q10, grenzen en drempels aan jouw soort en opstelling aan.

---

📖 [Hoofddocumentatie (Engels)](../../README.md)
