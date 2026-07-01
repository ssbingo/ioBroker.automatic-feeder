![Logo](../../admin/automatic-feeder.png)
# ioBroker.automatic-feeder

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

## Adaptateur automatic-feeder pour ioBroker

Cet adaptateur transforme n'importe quel interrupteur ioBroker déjà existant (une prise, un
relais, une sortie GPIO …) en un **distributeur de nourriture commandé par minuterie**. Il active
la sortie aux heures que tu as définies pendant un nombre de secondes déterminé et peut tenir
compte de la température ainsi que de l'alternance jour/nuit, afin que la distribution n'ait
jamais lieu au mauvais moment.

Ce document est un guide complet. Si tu n'as jamais utilisé l'adaptateur, lis-le de haut en
bas — le **Démarrage rapide** te permet d'effectuer ta première distribution en quelques
minutes, le reste explique chaque réglage en détail.

---

## Table des matières

1. [Ce que fait l'adaptateur](#1-ce-que-fait-ladaptateur)
2. [Prérequis](#2-prérequis)
3. [Installation](#3-installation)
4. [Démarrage rapide](#4-démarrage-rapide--la-première-distribution)
5. [La page de configuration en détail](#5-la-page-de-configuration-en-détail)
6. [Objets / Points de données](#6-objets--points-de-données)
7. [Exemples / Recettes](#7-exemples--recettes)
8. [Notifications Telegram](#8-notifications-telegram)
9. [Dépannage & FAQ](#9-dépannage--faq)
10. [Journalisation & recherche d'erreurs](#10-journalisation--recherche-derreurs)

---

## 1. Ce que fait l'adaptateur

Une « distribution » est au fond très simple : **sortie ACTIVÉE → attendre un nombre de secondes
réglable → DÉSACTIVÉE de nouveau**. Sur un distributeur de nourriture modifié, le moteur tourne
pendant ce temps et distribue la nourriture.

L'adaptateur gère **jusqu'à 5 interrupteurs**, chacun totalement indépendant et doté de son
propre onglet de configuration, nommé d'après l'interrupteur. Pour chaque interrupteur, tu
définis :

* **quand** la distribution a lieu — soit à des **heures fixes** (p. ex. 08:00 et 18:00), soit à
  **intervalle** régulier à l'intérieur d'une plage horaire (p. ex. toutes les 60 minutes entre
  08:00 et 18:00) ;
* **combien de temps** la sortie reste activée (durée de distribution en secondes) ;
* **si la distribution est bloquée** lorsque la température de l'eau ou de l'air est trop
  basse/haute ;
* **si la distribution est interdite la nuit** (selon le lever et le coucher du soleil réels pour
  ton emplacement) ;
* **si le processus de commutation est surveillé** (vérification que l'activation et la
  désactivation ont réellement eu lieu) et, en option, l'envoi d'un message **Telegram** sur le
  résultat ;
* **s'il faut réduire ou suspendre** la distribution pendant une saison **hivernale** récurrente —
  en option avec des rappels Telegram avant son début et sa fin ;
* **s'il faut adapter** l'intervalle et la portion à la température de l'eau/de l'air
  automatiquement (**alimentation dynamique**, modèle Q10) ;
* **s'il faut bloquer** la distribution lorsque l'**oxygène** (O₂) dissous est trop bas.

Tu peux déclencher une distribution **manuellement** à tout moment — directement depuis la page de
configuration (bouton avec durée librement réglable) ou via un point de données (p. ex. un bouton
dans une vue VIS).

> Important : l'adaptateur ne crée pas l'interrupteur lui-même. Il **pilote un objet déjà
> existant** dans ton ioBroker. Cet objet, tu le sélectionnes dans la configuration.

---

## 2. Prérequis

| Tu as besoin de | Détails |
|-------------|---------|
| **ioBroker** avec un **admin** récent (≥ 7) | La page de configuration est réalisée avec React. |
| **Un objet interrupteur** | Un point de données ioBroker accessible en écriture qui active/désactive le distributeur — p. ex. une prise (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), un relais ou une variable de script. |
| **Coordonnées géographiques** | Pour le calcul du lever/coucher du soleil. Soit depuis les paramètres système d'ioBroker, soit via une adresse/carte. **Obligatoire.** |
| *(optionnel)* Objets de température | Des points de données existants avec la température de l'air et/ou de l'eau, pour le blocage par température ou l'alimentation dynamique. Attribués **par interrupteur** dans l'onglet de l'interrupteur. |
| *(optionnel)* Objets **oxygène (O₂)** | Des points de données existants contenant l'oxygène dissous, pour bloquer la distribution lorsqu'il descend trop bas. Attribués **par interrupteur**. |
| *(optionnel)* Une instance **Telegram** | L'adaptateur officiel `telegram`, installé et démarré, si tu souhaites des notifications push. |
| Accès Internet sur l'hôte ioBroker | Uniquement pour la recherche d'adresse/la carte dans la configuration. Le fonctionnement normal se fait hors ligne. |

---

## 3. Installation

1. Dans l'**admin** ioBroker, ouvre l'onglet **Adaptateurs**.
2. Recherche **automatic-feeder** dans la liste des adaptateurs et clique sur **Installer**.
3. Crée une **instance** de l'adaptateur.
4. Ouvre les paramètres de l'instance (icône en forme d'engrenage) — la page de configuration avec
   l'onglet **Réglages de base** (Grundeinstellungen) devrait apparaître. Si elle reste vide,
   consulte [Dépannage](#9-dépannage--faq).

---

## 4. Démarrage rapide – la première distribution

Objectif : un interrupteur doit distribuer — immédiatement, pour le test — pendant 5 secondes.

1. **Ouvre les paramètres** de l'instance automatic-feeder.
2. Dans l'onglet **Réglages de base** (Grundeinstellungen) :
   * Sous **Emplacement** (Standort), laisse l'option *Reprendre les paramètres système* si ton
     ioBroker possède déjà des coordonnées. Sinon, choisis *Définir un emplacement spécifique*,
     saisis l'adresse, clique sur **Rechercher** et confirme le marqueur sur la carte.
   * Fais défiler vers le bas jusqu'à **Interrupteurs** (Schalter) et clique sur **Ajouter un
     interrupteur**.
   * Attribue un **Nom** (p. ex. `Koi-Teich`). Ce nom deviendra le titre d'un onglet dédié.
   * À côté de **Objet interrupteur** (Schalter-Objekt), clique sur l'icône de liste et choisis le
     point de données qui commande ton automate (p. ex. ta prise). L'interrupteur doit être
     **actif** (case à gauche cochée).
3. **Enregistre** (disquette/coche en bas). Un nouvel onglet portant le nom de ton interrupteur
   apparaît.
4. Ouvre cet **onglet d'interrupteur**. Tout en haut, sous **Distribution manuelle**, règle une
   durée (p. ex. `5` secondes) et clique sur **Distribuer maintenant**. La sortie devrait
   s'activer pendant 5 secondes puis se désactiver à nouveau.
5. Dans le même onglet, configure le véritable planning sous **Plan de distribution** (p. ex.
   heures fixes 08:00 et 18:00) et règle la **Durée de distribution** sous **Processus de
   distribution**, puis **Enregistre**.

C'est terminé — à partir de maintenant, l'adaptateur distribue automatiquement. La suite explique
les options en détail.

---

## 5. La page de configuration en détail

La configuration comporte un onglet **Réglages de base** (Grundeinstellungen) ainsi qu'**un onglet
par interrupteur** (créé automatiquement dès qu'un interrupteur a un nom). Si une page ne défile
pas, agrandis la fenêtre ou utilise la barre de défilement à droite — toutes les sections sont
accessibles.

### 5.1 Onglet « Réglages de base » (Grundeinstellungen)

#### Emplacement (obligatoire)

L'adaptateur a besoin de ta position géographique pour calculer le lever et le coucher du soleil
(pour le blocage nocturne). Deux possibilités :

* **Reprendre les paramètres système** — utilise la latitude/longitude de la configuration système
  d'ioBroker (recommandé si elles y sont déjà définies). Les valeurs actuelles sont affichées.
* **Définir un emplacement spécifique** — détermine la position toi-même :
  * Saisis une **adresse** et appuie sur **Rechercher**. L'adaptateur la résout (via
    OpenStreetMap / Nominatim) et place un marqueur.
  * Ou **clique sur la carte** / **fais glisser le marqueur** pour choisir l'endroit exact.
  * La latitude/longitude peut aussi être saisie directement ; la carte suit.

> La recherche d'adresse s'effectue dans le backend de l'adaptateur, l'**instance doit donc être
> en cours d'exécution**. La carte et la recherche nécessitent un accès Internet.

#### Fenêtre solaire (pas de distribution la nuit)

Définit la plage horaire pendant laquelle la distribution est autorisée :

* **Minutes après le lever du soleil** — ne distribuer qu'à partir de ce nombre de minutes *après*
  le lever du soleil.
* **Minutes avant le coucher du soleil** — arrêter ce nombre de minutes *avant* le coucher du
  soleil.

Exemple : avec un lever du soleil à 06:30, un coucher à 21:00 et des décalages de 30 / 30, la
distribution n'est autorisée qu'entre **07:00 et 20:30**. Chaque interrupteur peut tenir compte de
cette fenêtre individuellement ou l'ignorer (voir *Restrictions* dans l'onglet de l'interrupteur).
Les heures calculées figurent en outre dans les points de données `sunrise` / `sunset` et sont
recalculées automatiquement chaque nuit.

#### Interrupteurs

La liste des distributeurs de nourriture (jusqu'à 5). Pour chaque entrée :

* **Actif** (case) — seuls les interrupteurs actifs sont planifiés.
* **Nom** — texte libre ; devient le titre de l'onglet de l'interrupteur et le nom du canal dans
  l'arborescence des objets.
* **Objet interrupteur** — le point de données ioBroker existant qui est piloté. À sélectionner via
  l'icône de liste, à vider via la croix.

Avec **Ajouter un interrupteur**, tu en crées un de plus (max. 5) ; avec l'icône de corbeille, tu
en supprimes un. Lors de la suppression, ses points de données sont également effacés.

### 5.2 Onglets d'interrupteur

Chaque interrupteur configuré reçoit son propre onglet portant son nom. Il contient les sections
suivantes.

#### Distribution manuelle

* **Durée de la distribution manuelle (secondes)** — la durée utilisée par le bouton.
* **Distribuer maintenant** — déclenche immédiatement une distribution avec cette durée. Pratique
  pour tester ou pour une portion supplémentaire. (Le fait que les blocages soient ignorés ou non
  dépend de *Le déclencheur manuel ignore tous les blocages* sous *Restrictions*.)
* Pour le bouton, l'instance doit être en cours d'exécution et la configuration **enregistrée**.

#### Plan de distribution

Choisis **un** mode :

* **Heures fixes** — une liste d'horaires (`HH:mm`). Ajoute-en autant que tu veux ; l'automate
  fonctionne chaque jour à chacun d'eux. Exemple : `08:00` et `18:00`.
* **Intervalle à l'intérieur d'une plage** — distribuer de façon répétée à l'intérieur d'une
  fenêtre :
  * **Début de la plage** / **Fin de la plage** — p. ex. 08:00 à 18:00.
  * **Intervalle (minutes)** — p. ex. 60 → distribue chaque jour à 08:00, 09:00, … jusqu'à la fin
    de la fenêtre.

La prochaine heure planifiée figure à tout moment dans le point de données `status.nextFeeding`.

#### Processus de distribution

* **Durée de distribution (secondes)** — combien de temps la sortie reste ACTIVÉE lors d'une
  distribution planifiée.
* **Valeur d'activation** / **Valeur de désactivation** — les valeurs écrites dans l'objet
  interrupteur. Par défaut `true` et `false`, ce qui convient à la plupart des prises/relais. Si
  ton appareil attend des nombres ou du texte, saisis ici p. ex. `1` / `0` ou `ON` / `OFF`.

#### Sources de température et d'oxygène

Chaque interrupteur (station de distribution) possède **ses propres** capteurs — différents
bassins/aquariums peuvent utiliser des objets différents :

* **Température de l'air** — coche la case et sélectionne le point de données contenant la
  température de l'air de cette station.
* **Température de l'eau** — coche la case et sélectionne le point de données contenant la
  température de l'eau de cette station.
* **Oxygène (O₂)** — coche la case et sélectionne le point de données contenant l'oxygène dissous.

Seuls les points de données numériques sont pertinents. Les valeurs actuelles sont reflétées dans
les points de données `status.airTemperature`, `status.waterTemperature` et `status.oxygen` de cet interrupteur. Les
seuils se règlent ci-dessous (*Blocage par température*), et les températures alimentent aussi
l'*Alimentation dynamique*.

#### Blocage par température

Affiché uniquement pour les sources de température activées ci-dessus (*Sources de température et
d'oxygène*). Par interrupteur :

* **Bloquer selon la température de l'eau** — *Bloquer si en dessous de* et/ou *Bloquer si
  au-dessus de* (°C).
* **Bloquer selon la température de l'air** — la même chose pour l'air.

Si la température actuelle se trouve en dehors de la plage autorisée, la distribution est ignorée
et la raison est écrite dans `status.blockReason`. (Si une valeur de température est inconnue, cette
source ne bloque pas.)

#### Restrictions

* **Ne pas distribuer la nuit** — tient compte de la fenêtre solaire (décalages inclus).
  Désactive-le si cet interrupteur peut distribuer 24 h/24.
* **Le déclencheur manuel ignore tous les blocages** — si activé, le bouton et le point de données
  `feedNow` distribuent même en cas de blocage par température/nocturne actif.

#### Alimentation dynamique

Optionnel : adapte l'**intervalle et la durée de l'alimentation à la température** via le modèle Q10 (le métabolisme double environ par +10 °C). Nécessite une source de température active ; les heures fixes sont alors remplacées par un intervalle dans la fenêtre.

* **Activer / source** – activez et choisissez la température de l'eau ou de l'air.
* **Référence / Q10** – l'intervalle et la durée de base s'appliquent à la température de référence (par ex. 20 °C) ; Q10 généralement 2–2,5.
* **Intervalle / durée (base, min, max)** – limites de l'intervalle calculé (minutes) et de la durée (secondes).
* **Fenêtre de moyenne / hystérésis** – une moyenne glissante (par ex. 24 h) lisse les pics ; l'hystérésis évite une replanification pour des variations infimes.

Les valeurs actuelles figurent dans `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` et `status.dynamicDurationSec`. Une source d'**oxygène (O₂)** facultative peut bloquer l'alimentation lorsque l'oxygène dissous passe sous un seuil. La pause hivernale est prioritaire sur l'alimentation dynamique.

#### Pause hivernale

Pour chaque interrupteur, vous pouvez définir une **pause hivernale** récurrente (saisonnière, sous forme de dates `MM-JJ` qui se répètent chaque année et peuvent chevaucher le Nouvel An).

* **Activer la pause hivernale** – activer la pause.
* **Début / Fin de l'hiver** – choisissez le jour et le mois dans un calendrier (affiché en jj.mm), par ex. du 01.11 au 15.03.
* **Mode** – pendant la pause, **suspendre l'alimentation**, alimenter avec un intervalle propre **réduit** ou **une fois par jour** à une heure fixe ; une **durée d'alimentation hivernale** propre s'applique.
* **Rappels (Telegram)** – dans les jours précédant le début et la fin, un rappel est envoyé chaque jour (la dernière fois le jour même) à l'heure configurée. Nécessite une instance Telegram (voir ci-dessous).

L'état actuel est indiqué dans le point de données `status.winterActive`. L'alimentation reprend automatiquement à la fin de la pause.

#### Surveillance de la commutation

Après la commutation, l'adaptateur peut vérifier si l'interrupteur a **réellement** atteint l'état
activé puis désactivé, et signale pour chaque distribution l'un des trois résultats suivants :

| Résultat | Signification | Message |
|----------|-----------|---------|
| ✅ Succès | L'interrupteur s'est activé puis désactivé comme prévu | « Distribution déclenchée pour x s. » |
| ❌ Échec de l'activation | L'interrupteur n'a jamais confirmé l'état ACTIVÉ | « La distribution n'a pas pu être effectuée. Vérifiez l'interrupteur ! » |
| ❌ Échec de la désactivation | Il s'est activé mais ne s'est pas désactivé de nouveau | « Défaut : le distributeur ne s'est pas éteint ! » |

> Le message est envoyé dans la langue système ioBroker configurée (anglais par défaut).


* **Vérifier que l'interrupteur s'active et se désactive réellement** — active la surveillance.
* **Délai d'attente de la surveillance (secondes)** — combien de temps attendre la confirmation.
* **Tentatives de vérification** — combien de revérifications échelonnées sont effectuées avant de signaler un défaut (3 par défaut). Chaque tentative relit aussi l'état actuel, de sorte qu'un retour différé (par ex. radio Homematic) ne déclenche plus de faux défaut.

> **Important :** la surveillance ne fonctionne que si l'interrupteur **renvoie son état réel**,
> c.-à-d. que l'objet cible est mis à jour avec `ack=true` (typique des prises/relais avec retour
> d'état). Un simple booléen auxiliaire que personne ne confirme signalerait toujours une
> anomalie — il faut alors désactiver la surveillance pour cet interrupteur.

Le résultat figure en outre dans les points de données `status.lastResult` (texte) et `status.error` (boolean),
ce qui te permet d'y réagir (p. ex. déclencher ta propre notification).

#### Notifications Telegram

Envoie les messages de la surveillance de commutation vers Telegram — configuré **par
interrupteur** :

* **Instance Telegram** — choisis l'une des instances `telegram.*` installées (ou *Aucune*, pour
  désactiver Telegram pour cet interrupteur). Si aucune n'est installée, le champ le signale.
* **Destinataire Telegram (optionnel)** — un utilisateur/nom de chat précis, tel que configuré dans
  l'adaptateur telegram ; laisse vide pour envoyer à tous les destinataires configurés.
* **Cases à cocher** — sélectionne quels messages sont envoyés : distribution réussie, distribution
  impossible et/ou anomalie de désactivation.

Les **rappels de pause hivernale** (s'ils sont activés, voir *Pause hivernale*) sont envoyés à la
même instance Telegram, indépendamment de ces cases à cocher de surveillance.

La configuration complète est décrite sous [Notifications Telegram](#8-notifications-telegram).

---

## 6. Objets / Points de données

L'adaptateur crée les points de données suivants dans son espace de noms
(`automatic-feeder.<instanz>.`).

**Global**

| Point de données | Type | Signification |
|------------|-----|-----------|
| `info.connection` | boolean (ro) | L'adaptateur fonctionne et la configuration est valide. |
| `sunrise` / `sunset` | string (ro) | Lever/coucher du soleil calculé pour aujourd'hui. |

**Par interrupteur sous `switches.<id>.`** (`<id>` est un ID interne comme `sw-0`)

Directement sous l'interrupteur se trouvent le déclencheur manuel et deux sous-canaux :

* **`status`** (`switches.<id>.status.*`) – les points de données d'état en lecture seule listés ci-dessous.
* **`settings`** (`switches.<id>.settings.*`) – un miroir **modifiable** de la configuration de
  cet interrupteur. Écrire une nouvelle valeur ici (depuis VIS ou un script) modifie la configuration et
  redémarre l'instance pour que le changement prenne effet. Quelques champs dérivés sont en lecture seule
  (p. ex. `winterWindow`).

| Point de données | Type | Signification |
|------------|-----|-----------|
| `feedNow` | boolean (rw) | Écrire `true` pour distribuer manuellement. |
| `status.feedingActive` | boolean (ro) | Une distribution est en cours. |
| `status.lastFeeding` | string (ro) | Horodatage de la dernière distribution. |
| `status.nextFeeding` | string (ro) | Horodatage de la prochaine distribution planifiée. |
| `status.blocked` | boolean (ro) | La dernière tentative a été bloquée. |
| `status.blockReason` | string (ro) | Raison du blocage (nuit / température / oxygène). |
| `status.lastResult` | string (ro) | Texte du résultat de la dernière tentative de distribution. |
| `status.error` | boolean (ro) | La dernière tentative a connu une anomalie de commutation. |
| `status.winterActive` | boolean (ro) | La pause hivernale est actuellement active. |
| `status.winterLastStartReminder` | string (ro) | Date du dernier rappel « l'hiver commence » envoyé. |
| `status.winterLastEndReminder` | string (ro) | Date du dernier rappel « l'hiver se termine » envoyé. |
| `status.dynamicAvgTemperature` | number (ro) | Température moyenne utilisée par l'alimentation dynamique. |
| `status.dynamicRate` | number (ro) | Facteur de taux Q10 actuellement appliqué par l'alimentation dynamique. |
| `status.dynamicIntervalMin` | number (ro) | Intervalle dynamique actuellement calculé (minutes). |
| `status.dynamicDurationSec` | number (ro) | Durée dynamique actuellement calculée (secondes). |
| `status.airTemperature` | number (ro) | Valeur de la source de température de l'air propre à cet interrupteur. |
| `status.waterTemperature` | number (ro) | Valeur de la source de température de l'eau propre à cet interrupteur. |
| `status.oxygen` | number (ro) | Valeur de la source d'oxygène dissous propre à cet interrupteur. |

Ces points de données peuvent être utilisés dans VIS, des scripts ou d'autres adaptateurs — p. ex.
afficher `status.nextFeeding` sur un tableau de bord ou déclencher ta propre alarme lorsque `status.error =
true`.

---

## 7. Exemples / Recettes

**Bassin à koïs, deux fois par jour, uniquement s'il fait assez chaud**
* Mode *Heures fixes* → `08:00`, `18:00` ; durée `6` s.
* Dans l'onglet de l'interrupteur, sous *Sources de température et d'oxygène*, active *Température de
  l'eau* et choisis le capteur ; puis *Bloquer selon la température de l'eau* → *Bloquer si en
  dessous de* `8` °C (pas de distribution si l'eau est trop froide).
* *Ne pas distribuer la nuit* activé.

**Volière, petites portions fréquentes pendant la journée**
* Mode *Intervalle à l'intérieur d'une plage* → 07:00–19:00, intervalle `90` min ; durée `3` s.

**Bassin à koïs, adaptatif à la température (alimentation dynamique)**
* Dans l'onglet de l'interrupteur, sous *Sources de température et d'oxygène*, active *Température de
  l'eau* et choisis le capteur.
* Puis ouvre *Alimentation dynamique*, active-la, source *Température de l'eau*.
* Référence `20` °C, Q10 `2,2`, intervalle de base `60` min (min `30`, max `480`), durée de base
  `5` s (min `2`, max `15`). Il distribue alors plus souvent et un peu plus quand il fait chaud, et
  moins quand il fait froid.

**Trêve hivernale pour le bassin**
* Dans l'onglet de l'interrupteur, ouvre *Pause hivernale*, active-la, règle *Début de l'hiver*
  `01.11` et *Fin de l'hiver* `15.03`, mode *Suspendre l'alimentation*.
* Coche éventuellement les rappels pour recevoir une note Telegram quelques jours avant le début/la
  fin.

**Portion supplémentaire manuelle via un bouton VIS**
* Crée dans VIS un bouton qui écrit `true` sur `automatic-feeder.0.switches.sw-0.feedNow`.
* Active éventuellement *Le déclencheur manuel ignore tous les blocages*, afin que la distribution
  ait toujours lieu.

---

## 8. Notifications Telegram

1. Installe et configure l'adaptateur **telegram** (crée un bot avec @BotFather, saisis le token,
   démarre une conversation avec le bot). L'instance Telegram doit être **en cours d'exécution**.
2. Dans un **onglet d'interrupteur** automatic-feeder, ouvre la section **Notifications Telegram** :
   * Sélectionne l'**instance Telegram** dans la liste déroulante (p. ex. `telegram.0`).
   * Saisis éventuellement un **destinataire** (l'utilisateur/nom de chat affiché dans l'adaptateur
     telegram) ; laisse vide pour notifier tout le monde.
   * Coche les messages souhaités : *distribution réussie*, *distribution impossible*, *anomalie de
     désactivation*.
3. Enregistre. À partir de maintenant, les résultats de surveillance choisis sont envoyés vers
   Telegram (précédés du nom de l'interrupteur). Cela suppose que la *Surveillance de la
   commutation* soit activée pour cet interrupteur.
4. Les **rappels de pause hivernale** utilisent la même instance Telegram et le même destinataire.
   Ils se règlent dans la section *Pause hivernale* (nombre de jours avant le début/la fin et
   l'heure du rappel) et **ne nécessitent pas** que la surveillance soit activée.

---

## 9. Dépannage & FAQ

**La page de configuration est vide / blanche.**
Recharge le navigateur avec **Strg+Shift+R**. Si le problème persiste, redémarre l'instance et
rouvre les paramètres.

**Le nouvel icône / une modification n'apparaît pas.**
Cache du navigateur. Effectue un rechargement forcé (Strg+Shift+R).

**Rien n'est distribué du tout.**
Vérifie dans l'ordre : l'interrupteur est **Actif** ; un **objet interrupteur** est sélectionné ;
le **planning** est valide (`status.nextFeeding` affiche une heure) ; il n'est pas **bloqué** (consulte
`status.blocked` / `status.blockReason`) ; la **fenêtre solaire** n'exclut pas cette heure ; règle le
**niveau de journal** de l'instance sur `debug` et observe le journal.

**La distribution n'a jamais lieu la nuit, alors que je le souhaite.**
Soit désactive *Ne pas distribuer la nuit* pour cet interrupteur, soit ajuste les décalages
solaires. Sans coordonnées valides, le blocage nocturne est désactivé (et un avertissement est
journalisé).

**La surveillance signale toujours une anomalie.**
Ton objet interrupteur ne renvoie probablement pas son état réel (`ack=true`). Soit utilise un
interrupteur avec retour d'état, soit désactive la *Surveillance de la commutation* pour cet
interrupteur.

**L'alimentation dynamique ne change rien.**
Assure-toi que la source de température sélectionnée (eau ou air) est activée dans l'onglet de
l'interrupteur (*Sources de température et d'oxygène*) et fournit des valeurs. Juste après un
redémarrage, la moyenne glissante se remplit encore, elle part donc des valeurs de base. Surveille
`status.dynamicAvgTemperature` et `status.dynamicIntervalMin`.

**Rien n'est distribué alors que ce n'est pas l'hiver (ou la distribution a lieu alors qu'elle devrait être en pause).**
Vérifie les dates de la *Pause hivernale* (`Début de l'hiver` / `Fin de l'hiver`, format jj.mm) et
le mode. Le point de données `status.winterActive` indique si la pause est actuellement active.

**La recherche d'adresse indique que l'instance doit être en cours d'exécution.**
Démarre l'instance automatic-feeder — le géocodage s'effectue dans le backend.

**Les messages Telegram n'arrivent pas.**
Une instance Telegram est-elle sélectionnée dans l'onglet de l'interrupteur ? L'adaptateur telegram
est-il configuré et démarré ? Au moins un type de message est-il coché et la *Surveillance de la
commutation* activée ?

---

## 10. Journalisation & recherche d'erreurs

L'adaptateur journalise aux niveaux ioBroker habituels. Pour des messages détaillés, élève le
niveau de journal de l'instance (Instances → automatic-feeder.x → Niveau de journal) à **debug** ou
**silly** :

* **error** — erreurs nécessitant une attention (p. ex. échec de l'écriture sur l'interrupteur).
* **warn** — mauvaise configuration (pas de coordonnées, planning invalide …).
* **info** — étapes importantes (démarrage, distribution exécutée ou bloquée, déclencheur manuel).
* **debug** — déroulement détaillé (décisions de planification, mises à jour de température,
  géocodage, valeurs activation/désactivation, vérification confirmée/délai dépassé).
* **silly** — traçage très détaillé (chaque minuterie, chaque vérification de blocage, chaque
  changement d'état).

---

📖 [Documentation principale (anglais)](../../README.md)
