![Logo](../../admin/automatic-feeder.png)
# ioBroker.automatic-feeder

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

## Adattatore automatic-feeder per ioBroker

Questo adattatore trasforma un qualsiasi interruttore ioBroker già esistente (una presa
elettrica, un relè, un'uscita GPIO …) in un **distributore di mangime a comando temporizzato**.
Accende l'uscita agli orari da te stabiliti per un numero definito di secondi e può tenere conto
della temperatura e dell'alternanza giorno/notte, affinché non venga mai distribuito mangime al
momento sbagliato.

Questo documento è una guida completa. Se non hai mai usato l'adattatore, leggilo dall'inizio
alla fine: l'**Avvio rapido** ti porta alla prima distribuzione di mangime in pochi minuti, il
resto spiega ogni impostazione nel dettaglio.

---

## Indice

1. [Cosa fa l'adattatore](#1-cosa-fa-ladattatore)
2. [Requisiti](#2-requisiti)
3. [Installazione](#3-installazione)
4. [Avvio rapido](#4-avvio-rapido--la-prima-distribuzione-di-mangime)
5. [La pagina delle impostazioni nel dettaglio](#5-la-pagina-delle-impostazioni-nel-dettaglio)
6. [Oggetti / Punti dati](#6-oggetti--punti-dati)
7. [Esempi / Ricette](#7-esempi--ricette)
8. [Notifiche Telegram](#8-notifiche-telegram)
9. [Risoluzione dei problemi & FAQ](#9-risoluzione-dei-problemi--faq)
10. [Logging & Ricerca degli errori](#10-logging--ricerca-degli-errori)
11. [Alimentazione dinamica — contesto e fonti](#11-alimentazione-dinamica--contesto-e-fonti)
---

## 1. Cosa fa l'adattatore

Una „distribuzione di mangime" è nella sua essenza molto semplice: **uscita ACCESA → attesa di un
numero impostabile di secondi → di nuovo SPENTA**. In un distributore di mangime convertito,
durante questo tempo gira il motore e viene erogato il mangime.

L'adattatore gestisce **fino a 5 interruttori**, ciascuno del tutto indipendente e con una
propria scheda di configurazione, denominata in base all'interruttore. Per ogni interruttore
stabilisci:

* **quando** viene distribuito il mangime – o a **orari fissi** (ad es. 08:00 e 18:00) oppure a
  **intervalli** all'interno di una finestra temporale (ad es. ogni 60 minuti tra le 08:00 e le 18:00);
* **per quanto tempo** l'uscita rimane accesa (durata della distribuzione in secondi);
* **se bloccare** quando la temperatura dell'acqua o dell'aria è troppo bassa/alta;
* **se limitare** la distribuzione alla finestra diurna astronomica (alba/tramonto con scarti per
  ciascun interruttore, da una posizione di sistema, condivisa o per ciascun interruttore);
* **se monitorare la commutazione** (verifica che l'accensione e lo spegnimento siano realmente
  avvenuti) e, facoltativamente, l'invio di un messaggio **Telegram** sull'esito;
* **se ridurre o sospendere** la distribuzione durante una stagione **invernale** ricorrente –
  facoltativamente con promemoria Telegram prima che inizi e finisca;
* **se adattare** l'intervallo e la porzione alla temperatura dell'acqua/dell'aria
  automaticamente (**alimentazione dinamica**, modello Q10);
* **se bloccare** la distribuzione quando l'**ossigeno** disciolto (O₂) è troppo basso.
* **fino a 3 pause di alimentazione una tantum** (periodi assoluti con data e ora, ad es. una
  quarantena dopo un ripopolamento) con un messaggio **Telegram** all'inizio e alla fine di ciascuna;
* un **interruttore di pausa principale** (*Sospendi l'alimentazione ora*) che sospende
  immediatamente **tutta** l'alimentazione di un interruttore finché non lo spegni di nuovo, con un
  messaggio **Telegram** a ogni commutazione.

Puoi attivare una distribuzione **manualmente** in qualsiasi momento, direttamente dalla pagina
delle impostazioni (pulsante con durata liberamente selezionabile) oppure tramite un punto dati
(ad es. un pulsante in una vista VIS).

Facoltativamente, l'adattatore integra la **scheda relè Automatic-Feeder** (un ESP32 con tre
pulsanti a tempo e una propria interfaccia web). Decidi **per ogni interruttore** se questo usa una
tale scheda; quando la attivi per un interruttore nelle impostazioni di base, quell'interruttore
ottiene una scheda **Relè** in cui imposti l'indirizzo di rete della scheda, provi la connessione e
configuri i suoi tre tempi di alimentazione dei pulsanti (S1–S3) direttamente dall'adattatore.

> Importante: l'adattatore non crea l'interruttore da solo. **Comanda un oggetto già esistente**
> nel tuo ioBroker. Questo oggetto lo scegli tu nella configurazione.

---

## 2. Requisiti

| Ti serve | Dettagli |
|-------------|---------|
| **ioBroker** con **admin** aggiornato (≥ 7) | La pagina di configurazione è realizzata con React. |
| **Un oggetto interruttore** | Un punto dati ioBroker scrivibile che accende/spegne il distributore di mangime – ad es. una presa elettrica (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), un relè o una variabile di script. |
| *(facoltativo)* **Coordinate geografiche** | Servono per calcolare alba/tramonto per la **finestra astronomica** di ciascun interruttore. Necessarie solo se un interruttore usa quella finestra; acquisite dalle impostazioni di sistema di ioBroker, da una posizione condivisa, oppure configurate per ciascun interruttore. |
| *(facoltativo)* Oggetti di temperatura | Punti dati esistenti con temperatura dell'aria e/o dell'acqua, per il blocco in base alla temperatura o l'alimentazione dinamica. Assegnati **per ciascun interruttore** nella scheda dell'interruttore. |
| *(facoltativo)* Oggetti **ossigeno (O₂)** | Punti dati esistenti con l'ossigeno disciolto, per bloccare la distribuzione quando scende troppo. Assegnati **per ciascun interruttore**. |
| *(facoltativo)* Un'istanza **Telegram** | L'adattatore ufficiale `telegram`, configurato e avviato, se desideri notifiche push. |
| Accesso a Internet sull'host ioBroker | Solo per la ricerca dell'indirizzo/mappa nella configurazione. Il normale funzionamento avviene offline. |

---

## 3. Installazione

1. Nell'**admin** di ioBroker apri la scheda **Adattatori** (Adapter).
2. Cerca automatic-feeder nell'elenco degli adattatori e fai clic su **Installa**.
3. Crea un'**istanza** dell'adattatore.
4. Apri le impostazioni dell'istanza (icona ingranaggio): dovrebbe comparire la pagina di
   configurazione con la scheda **Impostazioni di base** (Grundeinstellungen). Se rimane vuota,
   vedi [Risoluzione dei problemi](#9-risoluzione-dei-problemi--faq).

---

## 4. Avvio rapido – la prima distribuzione di mangime

Obiettivo: un interruttore deve – subito, come test – distribuire mangime per 5 secondi.

1. **Apri le impostazioni** dell'istanza automatic-feeder.
2. Nella scheda **Impostazioni di base** (Grundeinstellungen):
   * In **Posizione** (Standort) lascia selezionato *Usa le impostazioni di sistema per tutti gli
     interruttori* (rilevante solo se in seguito attivi la finestra astronomica). Puoi anche
     scegliere una posizione condivisa o configurarla per ciascun interruttore.
   * Scorri in basso fino a **Interruttori** (Schalter) e fai clic su **Aggiungi interruttore**.
   * Assegna un **nome** (ad es. `Koi-Teich`). Questo nome diventa il titolo di una scheda dedicata.
   * Accanto a **Oggetto interruttore** (Schalter-Objekt) fai clic sull'icona elenco e seleziona
     il punto dati che comanda il tuo distributore (ad es. la tua presa). L'interruttore deve
     essere **attivo** (segno di spunta a sinistra).
3. **Salva** (dischetto/segno di spunta in basso). Compare una nuova scheda con il nome del tuo
   interruttore.
4. Apri questa **scheda dell'interruttore**. In alto, sotto **Distribuzione manuale**, imposta una
   durata (ad es. `5` secondi) e fai clic su **Distribuisci ora**. L'uscita dovrebbe accendersi per
   5 secondi e poi spegnersi di nuovo.
5. Nella stessa scheda configura il vero programma sotto **Programma di distribuzione** (ad es.
   orari fissi 08:00 e 18:00) e imposta la **Durata della distribuzione** sotto **Processo di
   distribuzione**, poi **Salva**.

Fatto – da ora l'adattatore distribuisce il mangime automaticamente. Tutto il resto spiega le
opzioni nel dettaglio.

---

## 5. La pagina delle impostazioni nel dettaglio

La configurazione ha una scheda **Impostazioni di base** (Grundeinstellungen) e **una scheda per
ogni interruttore** (creata automaticamente non appena un interruttore ha un nome). Se una pagina
non scorre, ingrandisci la finestra o usa la barra di scorrimento a destra: tutte le sezioni sono
raggiungibili.

### 5.1 Scheda „Impostazioni di base"

#### Posizione (per la finestra astronomica)

La posizione serve a calcolare alba/tramonto per la **finestra di distribuzione astronomica** che
può essere attivata per ciascun interruttore (vedi *Limitazioni* nella scheda dell'interruttore).
È necessaria solo se almeno un interruttore usa quella finestra. Tre possibilità:

* **Usa le impostazioni di sistema per tutti gli interruttori** – prende latitudine/longitudine
  dalla configurazione di sistema di ioBroker (consigliato se già impostate lì). Vengono mostrati i
  valori attuali.
* **Una posizione condivisa per tutti gli interruttori** – imposta un'unica posizione usata da
  tutti gli interruttori:
  * Inserisci un **indirizzo** e premi **Cerca**. L'adattatore lo risolve (tramite
    OpenStreetMap / Nominatim) e posiziona un marcatore.
  * Oppure **fai clic sulla mappa** / **trascina il marcatore** per scegliere il punto esatto.
  * Latitudine/longitudine possono anche essere inserite direttamente; la mappa segue.
* **Configura la posizione individualmente per ciascun interruttore** – ogni interruttore
  definisce la propria posizione nella sua scheda (utile quando le stazioni di alimentazione, ad
  es. i laghetti, si trovano in luoghi diversi).

> La ricerca dell'indirizzo viene eseguita nel backend dell'adattatore, perciò l'**istanza deve
> essere in esecuzione**. La mappa e la ricerca richiedono l'accesso a Internet.

Gli **scarti di alba/tramonto sono configurati per ciascun interruttore** (sotto *Limitazioni*) e
gli orari calcolati vengono pubblicati per ciascun interruttore come `status.sunrise` /
`status.sunset`, ricalcolati automaticamente ogni notte.

#### Interruttori

L'elenco dei distributori di mangime (fino a 5). Per ogni voce:

* **Attivo** (segno di spunta) – vengono programmati solo gli interruttori attivi.
* **Nome** – testo libero; diventa il titolo della scheda dell'interruttore e il nome del canale
  nell'albero degli oggetti.
* **Oggetto interruttore** – il punto dati ioBroker esistente che viene comandato. Selezionalo
  tramite l'icona elenco, svuotalo tramite la croce.

Con **Aggiungi interruttore** ne crei un altro (max. 5), con l'icona del cestino ne rimuovi uno.
Alla rimozione vengono cancellati anche i relativi punti dati.

* **Questo interruttore usa la scheda relè Automatic-Feeder (aggiunge una scheda relè)**
  (interruttore acceso/spento) – attivala solo per un interruttore la cui stazione di alimentazione
  usa la scheda relè Automatic-Feeder opzionale (ESP32). Quando è attiva, quell'interruttore ottiene
  una scheda **Relè** aggiuntiva (vedi sezione 5.3).

### 5.2 Schede degli interruttori

Ogni interruttore configurato riceve una propria scheda con il suo nome. Contiene le seguenti
sezioni.

#### Distribuzione manuale

* **Durata della distribuzione manuale (secondi)** – la durata utilizzata dal pulsante.
* **Distribuisci ora** – attiva immediatamente una distribuzione con questa durata. Comodo per
  fare test o per una porzione extra. (Se i blocchi vengano ignorati dipende da *L'attivatore
  manuale ignora tutti i blocchi* sotto *Limitazioni*.)
* Per il pulsante l'istanza deve essere in esecuzione e la configurazione **salvata**.

#### Programma di distribuzione

Scegli **una** modalità:

* **Orari fissi** – un elenco di orari (`HH:mm`). Aggiungine quanti ne vuoi; il distributore
  funziona ogni giorno a ciascuno di essi. Esempio: `08:00` e `18:00`.
* **Intervallo all'interno di un periodo** – distribuisci ripetutamente all'interno di una
  finestra:
  * **Inizio periodo** / **Fine periodo** – ad es. dalle 08:00 alle 18:00.
  * **Intervallo (minuti)** – ad es. 60 → distribuisce ogni giorno alle 08:00, 09:00, … fino alla
    fine della finestra.

Se la **finestra astronomica** è attiva (vedi *Limitazioni*), l'inizio/fine fissi del periodo
vengono sostituiti dalla finestra alba/tramonto e vengono nascosti; l'intervallo scorre quindi tra
alba e tramonto. Il prossimo orario programmato è sempre presente nel punto dati
`status.nextFeeding`.

#### Processo di distribuzione

* **Durata della distribuzione (secondi)** – per quanto tempo l'uscita rimane ACCESA durante una
  distribuzione programmata.
* **Valore di accensione** / **Valore di spegnimento** – i valori scritti nell'oggetto
  interruttore. Quelli predefiniti sono `true` e `false`, adatti alla maggior parte delle
  prese/relè. Se il tuo dispositivo si aspetta numeri o testo, inserisci qui ad es. `1` / `0`
  oppure `ON` / `OFF`.

#### Sorgenti di temperatura e ossigeno

Ogni interruttore (stazione di alimentazione) ha i **propri** sensori – laghetti/vasche diversi
possono usare oggetti diversi:

* **Temperatura dell'aria** – metti il segno di spunta e seleziona il punto dati che contiene la
  temperatura dell'aria di questa stazione.
* **Temperatura dell'acqua** – metti il segno di spunta e seleziona il punto dati che contiene la
  temperatura dell'acqua di questa stazione. È il sensore principale della **zona di alimentazione**
  (collocalo dove i pesci mangiano effettivamente, non in superficie).
* **Temperatura dell'acqua (profonda)** – *secondo sensore facoltativo* dell'acqua (ad es. vicino al
  fondo). Mostrato solo dopo aver attivato il sensore principale dell'acqua. Con due sensori scegli una
  **modalità di combinazione** per l'alimentazione dinamica: *Zona di alimentazione (solo superficiale)*
  [predefinita], *Media dei due*, *Strato più freddo* oppure *Stagionale* (usa il sensore superficiale
  finché è pari o superiore a una soglia, altrimenti quello profondo). Il **blocco** per temperatura usa
  sempre lo strato **più freddo** dei due. Un secondo sensore è utile solo in **laghetti profondi e non
  mescolati** (una pompa in funzione mescola l'acqua ed elimina qualsiasi stratificazione) — vedi
  *Alimentazione dinamica — contesto e fonti*.
* **Ossigeno (O₂)** – metti il segno di spunta e seleziona il punto dati che contiene l'ossigeno
  disciolto.

Sono utili solo i punti dati numerici. I valori attuali vengono rispecchiati nei punti dati
`status.airTemperature`, `status.waterTemperature`, `status.waterTemperatureDeep`, `status.oxygen`
(e `status.waterStratification` = superficiale − profondo) di questo interruttore. Le soglie si
impostano più in basso (*Blocco per temperatura*) e le temperature guidano anche l'*Alimentazione dinamica*.

#### Blocco per temperatura

Viene mostrato solo per le sorgenti di temperatura attivate sopra (*Sorgenti di temperatura e
ossigeno*). Per ogni interruttore:

* **Blocca in base alla temperatura dell'acqua** – *Blocca se inferiore a* e/o *Blocca se
  superiore a* (°C).
* **Blocca in base alla temperatura dell'aria** – lo stesso per l'aria.

Se la temperatura attuale è al di fuori dell'intervallo consentito, la distribuzione viene saltata
e il motivo viene scritto in `status.blockReason`. (Se un valore di temperatura è sconosciuto, questa
sorgente non blocca.)

#### Limitazioni

* **Limita la distribuzione alla finestra diurna astronomica (alba/tramonto + scarti)** – se
  attivo, la distribuzione è limitata alla finestra diurna calcolata dalla posizione di questo
  interruttore. Per *Intervallo* e *Alimentazione dinamica* questa finestra sostituisce l'inizio/
  fine fissi del periodo; per *Orari fissi* funge da guardia giorno/notte (gli orari fuori dalla
  finestra vengono saltati). Quando è attivo puoi impostare:
  * **Minuti dopo l'alba** – inizia questo numero di minuti *dopo* l'alba (predefinito 0).
  * **Minuti prima del tramonto** – smetti questo numero di minuti *prima* del tramonto
    (predefinito 0).
  * **Posizione per questo interruttore** – mostrata solo quando la *Posizione* generale è
    impostata su *individuale*: scegli *Usa le impostazioni di sistema* oppure *Imposta posizione
    specifica* (ricerca indirizzo + mappa) per questo interruttore. Gli orari calcolati compaiono
    in `status.sunrise` / `status.sunset`.
* **L'attivatore manuale ignora tutti i blocchi** – se attivo, il pulsante e i punti dati
  `feedNow` / `feedFor` distribuiscono mangime anche con blocco per temperatura/finestra attivo.

#### Alimentazione dinamica

Opzionale: adatta **intervallo e durata dell'alimentazione alla temperatura** con il modello Q10 (il metabolismo raddoppia circa ogni +10 °C). Richiede una fonte di temperatura attiva; gli orari fissi vengono quindi sostituiti da un intervallo all'interno della finestra.

* **Attiva / fonte** – attivalo e scegli la temperatura dell'acqua o dell'aria. Quando è configurato un
  secondo sensore dell'acqua (profondo), la temperatura dell'acqua qui usata è combinata dai due strati
  secondo la modalità di combinazione scelta (vedi *Sorgenti di temperatura e ossigeno*).
* **Riferimento / Q10** – l'intervallo e la durata base valgono alla temperatura di riferimento (es. 20 °C); Q10 tipicamente 2–2,5 (il metabolismo raddoppia circa ogni +10 °C — vedi *Alimentazione dinamica — contesto e fonti*).
* **Intervallo / durata (base, min, max)** – limiti per l'intervallo calcolato (minuti) e la durata (secondi). L'**intervallo base e l'intervallo massimo devono essere maggiori di 0**, altrimenti non è possibile pianificare alcuna distribuzione.
* **Finestra di media / isteresi** – una media mobile (es. 24 h) attenua i picchi; l'isteresi evita la ripianificazione per variazioni minime.

I valori correnti sono in `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` e `status.dynamicDurationSec`. Una fonte opzionale di **ossigeno (O₂)** può bloccare l'alimentazione quando l'ossigeno disciolto scende sotto una soglia. La pausa invernale ha la precedenza sull'alimentazione dinamica.

> Se l'alimentazione dinamica è attiva ma non è possibile calcolare un intervallo valido (l'intervallo base o massimo è 0, oppure una finestra temporale non valida), non viene programmato nulla: `status.nextFeeding` resta vuoto e `status.blockReason` mostra un'indicazione. Imposta un intervallo base e un intervallo massimo maggiori di 0.

#### Pausa invernale

Per ogni interruttore è possibile definire una **pausa invernale** ricorrente (stagionale, come date `MM-GG` che si ripetono ogni anno e possono attraversare il Capodanno).

* **Attiva la pausa invernale** – attivare la pausa.
* **Inizio / Fine inverno** – scegli giorno e mese da un calendario (mostrato come gg.mm), ad es. dal 01.11 al 15.03.
* **Modalità** – durante la pausa, **sospendi l'alimentazione**, alimenta con un intervallo proprio **ridotto** oppure **una volta al giorno** a un orario fisso; si applica una **durata di alimentazione invernale** propria.
* **Promemoria (Telegram)** – nei giorni prima dell'inizio e prima della fine viene inviato ogni giorno (l'ultima volta nel giorno stesso) un promemoria all'ora configurata. Richiede un'istanza Telegram (vedi sotto).

Lo stato attuale è mostrato nel punto dati `status.winterActive`. L'alimentazione riprende automaticamente al termine della pausa.

#### Pause di alimentazione

**Sospendi l'alimentazione ora (interruttore principale).** In cima a questa sezione un unico
**interruttore acceso/spento** consente di sospendere **tutta** l'alimentazione dell'interruttore
**immediatamente e a tempo indeterminato** — prevale sulle pause a tempo qui sotto **e** su ogni
modalità di alimentazione (orari fissi, intervallo, alimentazione dinamica, pausa invernale).
Riportalo su **spento** e l'alimentazione riprende esattamente come configurata prima; non serve
modificare nient'altro. Commutandolo viene inviato un messaggio **Telegram** (*acceso* / *spento*).
Uso tipico: un'interruzione spontanea (medicazione, manutenzione, trattamento dell'acqua) senza
toccare alcun programma. È modificabile dalla pagina delle impostazioni **e da VIS/script** tramite
`settings.pauseNow`, e il suo stato attuale è mostrato in `status.pauseManual`.

Sotto l'interruttore principale, fino a **3 pause di alimentazione una tantum** per interruttore
consentono di pianificare periodi assoluti con data e ora in cui l'alimentazione è **completamente
sospesa** (priorità superiore a ogni modalità di alimentazione). Uso tipico: una **quarantena dopo
un ripopolamento**, quando i nuovi pesci non devono essere alimentati per un po'.

* **Pausa 1 / 2 / 3** – metti il segno di spunta per attivarla, poi scegli un **Inizio** e una
  **Fine** (data + ora, mostrati come `DD.MM.YYYY HH:mm`), ad es. dal `15.07.2026 08:00` al
  `22.07.2026 18:00`.
* L'alimentazione si interrompe finché *adesso* rientra in una pausa attiva e riprende
  automaticamente al suo termine.
* Un messaggio **Telegram** viene inviato esattamente all'**inizio** e alla **fine** di ogni pausa
  (richiede un'istanza Telegram, vedi sotto). Se l'adattatore si avvia quando una pausa è già
  attiva, viene inviato solo il messaggio di *fine*.
* Modificabile dalla pagina delle impostazioni **e da VIS/script** tramite i punti dati `settings.*`
  (ad es. `settings.pause1Start`).

Lo stato attuale è mostrato in `status.pauseActive` e `status.pauseActiveUntil` (anche
l'interruttore principale pilota `status.pauseActive`).

#### Monitoraggio della commutazione

Dopo la commutazione l'adattatore può verificare se l'interruttore ha **effettivamente**
raggiunto lo stato di accensione e spegnimento, e segnala per ogni distribuzione uno di tre
risultati:

| Risultato | Significato | Messaggio |
|----------|-----------|---------|
| ✅ Successo | L'interruttore si è acceso e spento come previsto | „Alimentazione attivata per x s." |
| ❌ Accensione fallita | L'interruttore non ha mai confermato lo stato ACCESO | „Impossibile eseguire l'alimentazione. Controllare l'interruttore!" |
| ❌ Spegnimento fallito | si è acceso ma non si è più spento | „Guasto: l'alimentatore non si è spento!" |

> Il messaggio viene inviato nella lingua di sistema di ioBroker configurata (inglese per impostazione predefinita).


* **Verifica che l'interruttore si accenda e spenga effettivamente** – attiva il monitoraggio.
* **Timeout di monitoraggio (secondi)** – per quanto tempo si attende la conferma.
* **Tentativi di verifica** – quanti controlli scaglionati vengono eseguiti prima di segnalare un guasto (predefinito 3). Ogni tentativo rilegge anche lo stato attuale, così il feedback ritardato (ad es. radio Homematic) non genera più un falso guasto.

> **Importante:** il monitoraggio funziona solo se l'interruttore **restituisce il proprio stato
> reale**, cioè l'oggetto di destinazione viene aggiornato con `ack=true` (tipico per
> prese/relè con conferma di stato). Un semplice booleano ausiliario che nessuno conferma
> segnalerebbe sempre un guasto – in tal caso disattiva il monitoraggio per questo interruttore.

Il risultato è inoltre presente nei punti dati `status.lastResult` (testo) ed `status.error` (booleano),
così puoi reagire di conseguenza (ad es. attivare una notifica personalizzata).

#### Notifiche Telegram

Invia i messaggi del monitoraggio della commutazione a Telegram – configurato **per ciascun
interruttore**:

* **Lingua dei messaggi** – la lingua di tutti i testi in uscita per questo interruttore
  (Telegram, Sayit e l'annuncio di alimentazione): *Lingua di sistema* (la lingua di sistema di
  ioBroker) oppure una lingua specifica. I punti dati di stato non ne sono influenzati.
* **Istanza Telegram** – scegli una delle istanze `telegram.*` installate (oppure *Nessuna* per
  disattivare Telegram per questo interruttore). Se non ne è installata nessuna, il campo lo
  segnala.
* **Destinatario Telegram (facoltativo)** – un determinato nome utente/chat, come configurato
  nell'adattatore telegram; lascia vuoto per inviare a tutti i destinatari configurati.
* **Caselle di controllo** – seleziona quali messaggi vengono inviati: distribuzione riuscita, non
  effettuabile e/o guasto dello spegnimento.

I **promemoria della pausa invernale** (se attivi, vedi *Pausa invernale*) vengono inviati alla
stessa istanza Telegram, indipendentemente da queste caselle di controllo del monitoraggio.

La configurazione completa è descritta in [Notifiche Telegram](#8-notifiche-telegram).

#### Notifiche Sayit

Pronuncia gli stessi messaggi del monitoraggio della commutazione tramite un'istanza **Sayit
(sintesi vocale)** – configurato **per ciascun interruttore**, indipendentemente da Telegram
(entrambi possono essere attivi contemporaneamente):

* **Istanza Sayit** – scegli una delle istanze `sayit.*` installate (oppure *Nessuna* per
  disattivare Sayit per questo interruttore). Se non ne è installata nessuna, il campo lo segnala.
* **Volume (0-100, opzionale)** – il volume di riproduzione per questo interruttore; lascia vuoto
  per usare il valore predefinito dell'istanza Sayit.
* **Prova annuncio** – accanto alla selezione dell'istanza: pronuncia un breve testo di prova
  tramite l'istanza selezionata, così puoi verificare subito l'uscita audio, senza attendere una
  distribuzione.
* **Caselle di controllo** – seleziona quali messaggi vengono pronunciati: distribuzione riuscita,
  non effettuabile e/o guasto dello spegnimento (gli stessi tre di Telegram, ma selezionati
  separatamente qui).

Il testo pronunciato usa la **Lingua dei messaggi** selezionata nella sezione Telegram qui sopra.

#### Annuncio di alimentazione

Annuncia una distribuzione imminente con un anticipo configurabile, tramite Telegram e/o Sayit:

* **Annunciare l'alimentazione in anticipo** – attiva l'annuncio.
* **Anticipo (minuti)** – quanto tempo prima della distribuzione viene inviato l'annuncio (ad es.
  `5`).
* **Annuncia tramite Telegram** / **Annuncia tramite Sayit** – il canale (o i canali) usato per
  l'annuncio (ciascuno richiede la propria istanza configurata qui sopra).

L'annuncio viene pianificato insieme a ciascuna distribuzione. Se, al momento dell'annuncio, la
distribuzione risultasse **bloccata o in pausa** (notte, temperatura, ossigeno o una pausa di
alimentazione), l'annuncio viene saltato, così non promette mai una distribuzione che non avverrà.
Le distribuzioni manuali (il pulsante *Distribuisci ora* / `feedFor`) non hanno anticipo e non
vengono annunciate.

### 5.3 Scheda Relè (opzionale)

Questa scheda compare solo quando l'opzione per interruttore **Questo interruttore usa la scheda
relè Automatic-Feeder …** di questo interruttore è attiva nelle impostazioni di base (vedi sezione
5.1). Una scheda relè appartiene a un solo interruttore
(stazione di alimentazione). La scheda è un ESP32 con tre pulsanti a tempo (S1–S3) e una propria
interfaccia web, raggiungibile nella tua rete sulla **porta 80**. L'adattatore si limita a
**configurare** la scheda e a **mostrarne lo stato** – non attiva l'alimentazione tramite la scheda
(i pulsanti si azionano sulla scheda stessa).

> **Nota:** la scheda relè Automatic-Feeder è sviluppata in parallelo come **progetto separato**.
> L'adattatore funziona pienamente senza di essa – la scheda è un'aggiunta opzionale e comoda.
> Poiché evolve in modo autonomo, alcuni dei suoi dettagli possono cambiare
> indipendentemente dall'adattatore.

* **Indirizzo della scheda (IP o host mDNS)** – ad es. `192.168.1.50` oppure `feeder.local`. Un IP
  fisso è il più affidabile; l'mDNS (`.local`) funziona solo se il tuo sistema host è in grado di
  risolverlo. È ammesso un suffisso `:port`, ma di solito non serve (predefinito `80`).
* **Prova connessione e recupera tempi** – contatta la scheda una volta. Un chip verde *Connesso* e
  l'host/IP/firmware della scheda confermano una connessione funzionante; i tre tempi di
  alimentazione dei pulsanti vengono quindi letti dalla scheda nei campi sottostanti. Un chip rosso
  *Non connesso* mostra l'errore.
* **Tempi di alimentazione dei pulsanti (secondi)** – il tempo di alimentazione di ciascun pulsante
  **S1**, **S2** e **S3** (1–600 s). Poiché questi sono **modificabili anche sull'interfaccia web
  della scheda stessa**, *recuperali* sempre prima, poi modificali.
* **Salva tempi sulla scheda** – scrive i tre valori sulla scheda.
* **Riavvia scheda** – riavvia l'ESP32 tramite la sua API (`POST /api/reboot`). Dopo una richiesta
  di conferma la scheda si riavvia e resta offline per alcuni secondi, poi torna disponibile
  automaticamente.

In fondo alla scheda, una **Panoramica del sistema** mostra i dati di sistema in tempo reale della
scheda dopo una prova di connessione riuscita (il pulsante *Prova connessione e recupera tempi*):
versione del firmware, nome host, indirizzo IP, rete Wi-Fi, potenza del segnale (dBm), indirizzo
MAC, tempo di attività, memoria libera e il motivo dell'ultimo reset.

La connessione viene inoltre rispecchiata nell'albero degli oggetti e aggiornata ogni 60 s – vedi i
punti dati `relay.*` nella sezione 6.

---

## 6. Oggetti / Punti dati

> **Nota:** tutti i punti dati con timestamp sono mostrati nel **fuso orario locale del sistema** (formato `GG.MM.AAAA HH:MM:SS`, es. `01.07.2026 16:20:00`). Per VIS e gli script ogni timestamp ha inoltre un **gemello numerico** che termina con `…Ts` (tempo Unix in **millisecondi**, `0` = nessuno) — ideale per conti alla rovescia e barre temporali senza alcun parsing di stringhe, e indipendente dal formato di visualizzazione.

L'adattatore crea i seguenti punti dati nel suo namespace
(`automatic-feeder.<instanz>.`).

**Globali**

| Punto dati | Tipo | Significato |
|------------|-----|-----------|
| `info.connection` | boolean (ro) | L'adattatore è in esecuzione e la configurazione è valida. |

**Per ogni interruttore sotto `switches.<id>.`** (`<id>` è un ID interno come `sw-0`)

Direttamente sotto l'interruttore si trovano l'attivatore manuale e due sotto-canali:

* **`status`** (`switches.<id>.status.*`) – i punti dati di stato di sola lettura elencati sotto.
* **`settings`** (`switches.<id>.settings.*`) – un mirror **modificabile** della configurazione di
  questo interruttore. Scrivendovi un nuovo valore (da VIS o da uno script) si modifica la
  configurazione e si riavvia l'istanza affinché la modifica abbia effetto. Alcuni campi derivati
  sono di sola lettura (ad es. `winterWindow`).
* **`relay`** (`switches.<id>.relay.*`) – presente solo quando questo interruttore usa una scheda
  relè; i punti dati di stato della scheda relè di sola lettura elencati in fondo alla tabella.

| Punto dati | Tipo | Significato |
|------------|-----|-----------|
| `feedNow` | boolean (rw) | Scrivi `true` per distribuire manualmente. |
| `feedFor` | number (rw) | Scrivi una durata in **secondi** per attivare **una distribuzione esattamente con quella durata** — nessuna modifica alla configurazione, nessun riavvio. Si reimposta su `0` dopo l'esecuzione. |
| `status.feedingActive` | boolean (ro) | È in corso una distribuzione. |
| `status.feedingEndsTs` | number (ro) | Fine della distribuzione **in corso** come tempo Unix in ms (`0` = nessuna distribuzione) — per un conto alla rovescia della durata in tempo reale (ad es. 15 → 0 s) in VIS. |
| `status.feedingDurationSec` | number (ro) | Durata totale dell'alimentazione **in corso** in secondi (`0` = nessuna alimentazione) — consente a un widget VIS di disegnare un anello di avanzamento esatto accanto al conto alla rovescia. |
| `status.lastFeeding` | string (ro) | Momento dell'ultima distribuzione. |
| `status.lastFeedingTs` | number (ro) | Ultima distribuzione come tempo Unix in ms (`0` = ancora nessuna). |
| `status.nextFeeding` | string (ro) | Momento della prossima distribuzione programmata. |
| `status.nextFeedingTs` | number (ro) | Prossima distribuzione programmata come tempo Unix in ms (`0` = nulla programmato). |
| `status.blocked` | boolean (ro) | L'ultimo tentativo è stato bloccato. |
| `status.blockReason` | string (ro) | Motivo del blocco (notte/temperatura/ossigeno), nella lingua di sistema. |
| `status.blockReasonCode` | string (ro) | Il motivo del blocco come **codice stabile leggibile dalla macchina** (ad es. `blockNight`, `blockWaterBelow`, `blockPauseManual`; vuoto = non bloccato) — per logiche di icone/colori in VIS, indipendente dalla lingua. |
| `status.lastResult` | string (ro) | Testo dell'esito dell'ultimo tentativo di distribuzione. |
| `status.error` | boolean (ro) | L'ultimo tentativo ha avuto un guasto di commutazione. |
| `status.winterActive` | boolean (ro) | La pausa invernale è attualmente attiva. |
| `status.winterLastStartReminder` | string (ro) | Data dell'ultimo promemoria „l'inverno inizia" inviato. |
| `status.winterLastEndReminder` | string (ro) | Data dell'ultimo promemoria „l'inverno finisce" inviato. |
| `status.pauseManual` | boolean (ro) | La pausa principale manuale (*Sospendi l'alimentazione ora* / `settings.pauseNow`) è attiva. |
| `status.pauseActive` | boolean (ro) | Una pausa di alimentazione una tantum è attualmente attiva. |
| `status.pauseActiveUntil` | string (ro) | Fine della pausa di alimentazione attualmente attiva (vuoto se nessuna). |
| `status.pauseActiveUntilTs` | number (ro) | Fine della pausa di alimentazione attiva come tempo Unix in ms (`0` = nessuna). |
| `status.dynamicAvgTemperature` | number (ro) | Temperatura media usata dall'alimentazione dinamica. |
| `status.dynamicRate` | number (ro) | Fattore di velocità Q10 attualmente applicato dall'alimentazione dinamica. |
| `status.dynamicIntervalMin` | number (ro) | Intervallo dinamico attualmente calcolato (minuti). |
| `status.dynamicDurationSec` | number (ro) | Durata dinamica attualmente calcolata (secondi). |
| `status.airTemperature` | number (ro) | Valore della sorgente di temperatura dell'aria propria di questo interruttore. |
| `status.waterTemperature` | number (ro) | Valore della sorgente di temperatura dell'acqua propria di questo interruttore (sensore della zona di alimentazione / superficiale). |
| `status.waterTemperatureDeep` | number (ro) | Valore del sensore facoltativo di temperatura dell'acqua profonda di questo interruttore. |
| `status.waterStratification` | number (ro) | Differenza di temperatura superficiale − profondo (solo con due sensori dell'acqua). |
| `status.oxygen` | number (ro) | Valore della sorgente di ossigeno disciolto propria di questo interruttore. |
| `status.sunrise` / `status.sunset` | string (ro) | Alba/tramonto calcolati per la posizione di questo interruttore (finestra astronomica). |
| `status.sunriseTs` / `status.sunsetTs` | number (ro) | Alba/tramonto come tempo Unix in ms — ad es. per una barra di avanzamento del giorno in VIS. |
| `relay.connected` | boolean (ro) | La scheda relè configurata per questo interruttore è raggiungibile (solo quando questo interruttore usa una scheda relè). |
| `relay.info` | string (ro) | Identità della scheda relè (host / IP / firmware) dall'ultimo polling riuscito. |
| `relay.active` | boolean (ro) | Il timer della scheda relè è attualmente in funzione. |
| `relay.remaining` | number (ro) | Secondi rimanenti sul timer in funzione della scheda relè. |

Questi punti dati possono essere usati in VIS, negli script o in altri adattatori – ad es.
mostrare `status.nextFeeding` su una dashboard oppure attivare un allarme personalizzato quando
`status.error = true`.

---

## 7. Esempi / Ricette

**Laghetto Koi, due volte al giorno, solo con calore sufficiente**
* Modalità *Orari fissi* → `08:00`, `18:00`; durata `6` s.
* Nella scheda dell'interruttore, sotto *Sorgenti di temperatura e ossigeno*, attiva *Temperatura
  dell'acqua* e seleziona il sensore; poi *Blocca in base alla temperatura dell'acqua* → *Blocca se
  inferiore a* `8` °C (nessuna distribuzione con acqua troppo fredda).
* Sotto *Limitazioni*, attiva *Limita la distribuzione alla finestra diurna astronomica* affinché
  non venga distribuito nulla dopo il buio.

**Voliera, solo durante le ore diurne (finestra astronomica)**
* Modalità *Intervallo all'interno di un periodo* → intervallo `90` min; durata `3` s.
* Sotto *Limitazioni*, attiva la finestra astronomica con scarti `30` / `30` min → la distribuzione
  scorre da 30 min dopo l'alba a 30 min prima del tramonto, seguendo automaticamente le stagioni.

**Laghetto Koi, adattivo alla temperatura (alimentazione dinamica)**
* Nella scheda dell'interruttore, sotto *Sorgenti di temperatura e ossigeno*, attiva *Temperatura
  dell'acqua* e seleziona il sensore.
* Poi apri *Alimentazione dinamica*, attivala, fonte *Temperatura dell'acqua*.
* Riferimento `20` °C, Q10 `2,2`, intervallo base `60` min (min `30`, max `480`), durata base `5` s
  (min `2`, max `15`). Distribuisce quindi più spesso e un po' di più con il caldo, e meno con il
  freddo.

**Pausa invernale per il laghetto**
* Nella scheda dell'interruttore apri *Pausa invernale*, attivala, imposta *Inizio inverno* `01.11`
  e *Fine inverno* `15.03`, modalità *Sospendi l'alimentazione*.
* Facoltativamente spunta i promemoria così ricevi una nota Telegram alcuni giorni prima
  dell'inizio/della fine.

**Quarantena dopo un ripopolamento (pausa di alimentazione)**
* Nella scheda dell'interruttore apri *Pause di alimentazione*, spunta *Pausa 1* e imposta *Inizio*
  `15.07.2026 08:00`, *Fine* `22.07.2026 18:00` → in quella finestra non viene distribuito nulla,
  poi riprende automaticamente.
* Con un'istanza Telegram configurata ricevi un messaggio all'inizio e alla fine della pausa.

**Sospendi subito l'alimentazione (interruttore principale)**
* Nella scheda dell'interruttore apri *Pause di alimentazione* e attiva *Sospendi l'alimentazione
  ora* – oppure scrivi `true` su `automatic-feeder.0.switches.sw-0.settings.pauseNow` da un
  interruttore VIS.
* Tutta l'alimentazione si interrompe immediatamente (prevalendo su ogni modalità) finché non lo
  spegni di nuovo; ogni commutazione invia un messaggio Telegram. `status.pauseManual` mostra lo
  stato attuale.

**Porzione extra manuale tramite pulsante VIS**
* In VIS crea un pulsante che scrive `true` su `automatic-feeder.0.switches.sw-0.feedNow`.
* Oppure usa uno slider/campo numerico che scrive i **secondi** su
  `automatic-feeder.0.switches.sw-0.feedFor` → distribuisce **una volta esattamente con quella
  durata** (nessuna modifica alla configurazione, nessun riavvio; lo stato si reimposta poi su `0`).
* Facoltativamente attiva *L'attivatore manuale ignora tutti i blocchi*, affinché venga sempre
  distribuito il mangime.

---

## 8. Notifiche Telegram

1. Installa e configura l'adattatore **telegram** (crea un bot con @BotFather, inserisci il token,
   avvia una chat con il bot). L'istanza Telegram deve essere **in esecuzione**.
2. In una **scheda dell'interruttore** di automatic-feeder apri la sezione **Notifiche Telegram**:
   * Seleziona l'**istanza Telegram** nel menu a tendina (ad es. `telegram.0`).
   * Facoltativamente inserisci un **destinatario** (il nome utente/chat mostrato nell'adattatore
     telegram); lascia vuoto per notificare tutti.
   * Spunta i messaggi desiderati: *distribuzione riuscita*, *non effettuabile*, *guasto dello
     spegnimento*.
3. Salva. Da ora i risultati di monitoraggio selezionati vengono inviati a Telegram (preceduti dal
   nome dell'interruttore). Il presupposto è che il *Monitoraggio della commutazione* sia attivato
   per questo interruttore.
4. I **promemoria della pausa invernale** usano la stessa istanza Telegram e lo stesso
   destinatario. Vengono controllati nella sezione *Pausa invernale* (giorni prima
   dell'inizio/della fine e l'ora del promemoria) e **non** richiedono che il monitoraggio sia
   attivato.

---

## 9. Risoluzione dei problemi & FAQ

**La pagina delle impostazioni è vuota / bianca.**
Ricarica il browser con **Strg+Shift+R**. Se il problema persiste, riavvia l'istanza e riapri le
impostazioni.

**La nuova icona / una modifica non compare.**
Cache del browser. Ricarica forzatamente con **Strg+Shift+R**.

**Non viene distribuito alcun mangime.**
Controlla nell'ordine: l'interruttore è **Attivo**; è selezionato un **Oggetto interruttore**; il
**programma** è valido (`status.nextFeeding` mostra un orario); non è **bloccato** (controlla `status.blocked` /
`status.blockReason`); la **finestra astronomica** non esclude l'orario; imposta il **livello di
log** dell'istanza su `debug` e osserva il log.

**Non viene mai distribuito mangime di notte, anche se lo desidero.**
Disattiva *Limita la distribuzione alla finestra diurna astronomica* per questo interruttore
oppure modifica i suoi scarti di alba/tramonto. Se la finestra astronomica è attiva ma
l'interruttore non ha coordinate valide, la sua guardia della finestra resta inattiva e viene
registrato un avviso nel log.

**Il monitoraggio segnala sempre un guasto.**
Il tuo oggetto interruttore probabilmente non restituisce il proprio stato reale (`ack=true`).
Usa un interruttore con conferma di stato oppure disattiva il *Monitoraggio della commutazione*
per questo interruttore.

**L'alimentazione dinamica non cambia nulla.**
Assicurati che la fonte di temperatura selezionata (acqua o aria) sia attivata nella scheda
dell'interruttore (*Sorgenti di temperatura e ossigeno*) e fornisca valori. Subito dopo un riavvio la media mobile si sta ancora riempiendo, quindi
parte dai valori base. Osserva `status.dynamicAvgTemperature` e `status.dynamicIntervalMin`.

**L'alimentazione dinamica è attiva ma non viene mai distribuito nulla (`status.nextFeeding` è vuoto).**
L'**intervallo base o l'intervallo massimo è 0** (oppure la finestra temporale non è valida), quindi non è possibile calcolare alcun intervallo – `status.blockReason` mostra allora un'indicazione. Imposta un intervallo base e un intervallo massimo maggiori di 0 (e una finestra valida). Nota: lasciare *sia* l'intervallo minimo *sia* quello massimo a 0 forza anch'esso il risultato a 0.

**Non viene distribuito nulla anche se non è inverno (oppure distribuisce quando dovrebbe essere in pausa).**
Controlla le date della *Pausa invernale* (`Inizio inverno` / `Fine inverno`, formato gg.mm) e la
modalità. Il punto dati `status.winterActive` indica se la pausa è attualmente attiva.

**La ricerca dell'indirizzo dice che l'istanza deve essere in esecuzione.**
Avvia l'istanza automatic-feeder – il geocoding viene eseguito nel backend.

**I messaggi Telegram non arrivano.**
Nella scheda dell'interruttore è selezionata un'istanza Telegram? L'adattatore telegram è
configurato e avviato? È spuntato almeno un tipo di messaggio ed è attivato il *Monitoraggio
della commutazione*?

---

## 10. Logging & Ricerca degli errori

L'adattatore registra ai consueti livelli di ioBroker. Per messaggi dettagliati alza il livello
di log dell'istanza (Istanze → automatic-feeder.x → Livello di log) a **debug** o **silly**:

* **error** – errori che richiedono attenzione (ad es. scrittura sull'interruttore fallita).
* **warn** – errori di configurazione (nessuna coordinata, programma non valido …).
* **info** – traguardi (avvio, una distribuzione eseguita o bloccata, attivatore manuale).
* **debug** – svolgimento dettagliato (decisioni di pianificazione, aggiornamenti di temperatura,
  geocoding, valori di accensione/spegnimento, verifica confermata/timeout).
* **silly** – tracciamento molto dettagliato (ogni timer, ogni controllo di blocco, ogni cambio
  di stato).

---

## 11. Alimentazione dinamica — contesto e fonti

I pesci (koi, pesci rossi, carpe da laghetto) sono **pecilotermi (ectotermi)**: il loro metabolismo
segue la temperatura dell'acqua. Come regola pratica il tasso metabolico **raddoppia circa a ogni
+10 °C**, che è esattamente il **coefficiente Q10** (tipicamente 2–3) usato da questo adattatore —
perciò alimentare più spesso e un po' di più quando fa caldo, e meno quando fa freddo, è
fisiologicamente giustificato.

**Indicazioni pratiche sulla temperatura (koi/pesci da laghetto):**

* **sotto ~4–5 °C** – non alimentare (usa la *Pausa invernale*).
* **~4–10 °C** – attività ridotta; alimenta di rado o per niente, con mangime facilmente digeribile
  (germe di grano).
* **~10–15 °C** – alimentazione ridotta; il sistema immunitario è ancora debole (~12 °C).
* **~15–25 °C** – intervallo di crescita ottimale, alimentazione completa.
* **sopra ~28 °C** – l'**ossigeno** disciolto diventa il fattore limitante → qui è utile il blocco per O₂.

**Dove misurare e perché un secondo sensore:** la temperatura che conta è quella dell'acqua che i
pesci occupano effettivamente (la **zona di alimentazione**), *non* la superficie (che può differire
di diversi gradi). In un laghetto mescolato da una pompa in funzione, o in un laghetto poco profondo,
un solo sensore ben posizionato è sufficiente. Solo in un **laghetto profondo e non mescolato** l'acqua
si stratifica: sopra i 4 °C l'acqua calda sta in alto (più fredda sotto); sotto i 4 °C si inverte,
lasciando un rifugio a ~4 °C vicino al fondo. Lì un **secondo sensore (profondo)** aggiunge valore —
per la sicurezza (alimentare in base allo strato più freddo), per un passaggio stagionale
superficiale/profondo e per rendere visibile la stratificazione (`status.waterStratification`). Per la
maggior parte dei laghetti è facoltativo.

**Fonti / approfondimenti:**

* Volkoff H. & Rønnestad I. (2020): *Effects of temperature on feeding and digestive processes in fish.* Temperature 7(4):307–320. <https://pubmed.ncbi.nlm.nih.gov/33251280/>
* K.O.I. – *Water Temperature and Koi.* <https://koiorganisationinternational.org/koi-articles/water-temperature-and-koi>
* K.O.I. – *The Science behind Cold Water in Koi Ponds.* <https://koiorganisationinternational.org/koi-articles/science-behind-cold-water-koi-ponds>
* Pond Informer – *Koi feeding guide.* <https://pondinformer.com/koi-feeding-guide/>

> Queste cifre sono indicazioni generali per koi/pesci da laghetto, non un sostituto dell'osservazione
> dei tuoi animali. Adatta la temperatura di riferimento, il Q10, i limiti e le soglie alla tua specie
> e al tuo impianto.

---

📖 [Documentazione principale (inglese)](../../README.md)
