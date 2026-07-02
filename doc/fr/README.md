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
11. [Alimentation dynamique — contexte & sources](#11-alimentation-dynamique--contexte--sources)
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
* **s'il faut restreindre** la distribution à la fenêtre diurne astronomique (lever/coucher du
  soleil avec des décalages propres à chaque interrupteur, à partir d'un emplacement système,
  partagé ou propre à l'interrupteur) ;
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
| *(optionnel)* **Coordonnées géographiques** | Utilisées pour calculer le lever/coucher du soleil pour la **fenêtre astronomique** propre à chaque interrupteur. Nécessaires uniquement si un interrupteur utilise cette fenêtre ; reprises depuis les paramètres système d'ioBroker, une position partagée unique ou configurées par interrupteur. |
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
   * Sous **Emplacement** (Standort), laisse l'option *Utiliser les paramètres système pour tous
     les interrupteurs* sélectionnée (pertinent uniquement si tu actives plus tard la fenêtre
     astronomique). Tu peux aussi choisir un emplacement partagé ou le configurer par interrupteur.
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

#### Emplacement (pour la fenêtre astronomique)

L'emplacement sert à calculer le lever/coucher du soleil pour la **fenêtre de distribution
astronomique** qui peut être activée par interrupteur (voir *Restrictions* dans l'onglet de
l'interrupteur). Il n'est nécessaire que si au moins un interrupteur utilise cette fenêtre. Trois
possibilités :

* **Utiliser les paramètres système pour tous les interrupteurs** — reprend la
  latitude/longitude de la configuration système d'ioBroker (recommandé si elles y sont déjà
  définies). Les valeurs actuelles sont affichées.
* **Un emplacement partagé pour tous les interrupteurs** — définit une position unique que tous
  les interrupteurs utilisent :
  * Saisis une **adresse** et appuie sur **Rechercher**. L'adaptateur la résout (via
    OpenStreetMap / Nominatim) et place un marqueur.
  * Ou **clique sur la carte** / **fais glisser le marqueur** pour choisir l'endroit exact.
  * La latitude/longitude peut aussi être saisie directement ; la carte suit.
* **Configurer l'emplacement individuellement par interrupteur** — chaque interrupteur définit
  son propre emplacement dans son propre onglet (utile lorsque les stations de distribution,
  p. ex. des bassins, se trouvent à des endroits différents).

> La recherche d'adresse s'effectue dans le backend de l'adaptateur, l'**instance doit donc être
> en cours d'exécution**. La carte et la recherche nécessitent un accès Internet.

Les **décalages du lever/coucher du soleil se configurent par interrupteur** (sous
*Restrictions*), et les heures calculées sont publiées par interrupteur dans `status.sunrise` /
`status.sunset`, recalculées automatiquement chaque nuit.

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

Si la **fenêtre astronomique** est activée (voir *Restrictions*), le début/la fin de la fenêtre
fixe sont remplacés par la fenêtre lever/coucher du soleil et sont masqués ; l'intervalle se
déroule alors entre le lever et le coucher du soleil. La prochaine heure planifiée figure à tout
moment dans le point de données `status.nextFeeding`.

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
  température de l'eau de cette station. C'est le capteur principal de la **zone d'alimentation**
  (place-le là où les poissons se nourrissent réellement, pas à la surface).
* **Température de l'eau (profondeur)** — *second capteur optionnel* d'eau (p. ex. près du fond).
  Affiché uniquement une fois le capteur d'eau principal activé. Avec deux capteurs, tu choisis un
  **mode de combinaison** pour l'alimentation dynamique : *Zone d'alimentation (peu profonde
  uniquement)* [par défaut], *Moyenne des deux*, *Couche la plus froide* ou *Saisonnier* (utilise le
  capteur peu profond tant qu'il est au-dessus ou égal à un seuil, sinon le capteur en profondeur).
  Le **blocage** par température utilise toujours la **plus froide** des deux couches. Un second
  capteur n'est utile que dans les **bassins profonds et non brassés** (une pompe en marche brasse
  l'eau et supprime toute stratification) — voir *Alimentation dynamique — contexte & sources*.
* **Oxygène (O₂)** — coche la case et sélectionne le point de données contenant l'oxygène dissous.

Seuls les points de données numériques sont pertinents. Les valeurs actuelles sont reflétées dans
les points de données `status.airTemperature`, `status.waterTemperature`, `status.waterTemperatureDeep`,
`status.oxygen` (et `status.waterStratification` = peu profonde − profonde) de cet interrupteur. Les
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

* **Restreindre la distribution à la fenêtre diurne astronomique (lever/coucher du soleil +
  décalages)** — lorsqu'elle est activée, la distribution est limitée à la fenêtre diurne calculée
  à partir de l'emplacement de cet interrupteur. Pour l'*Intervalle* et l'*Alimentation dynamique*,
  cette fenêtre remplace le début/la fin de la fenêtre fixe ; pour les *Heures fixes*, elle agit
  comme garde jour/nuit (les heures hors de la fenêtre sont ignorées). Une fois activée, tu peux
  régler :
  * **Minutes après le lever du soleil** — commencer ce nombre de minutes *après* le lever du
    soleil (par défaut 0).
  * **Minutes avant le coucher du soleil** — arrêter ce nombre de minutes *avant* le coucher du
    soleil (par défaut 0).
  * **Emplacement pour cet interrupteur** — affiché uniquement lorsque l'*Emplacement* général est
    réglé sur *individuel* : choisis *Utiliser les paramètres système* ou *Définir un emplacement
    spécifique* (recherche d'adresse + carte) pour cet interrupteur. Les heures calculées
    apparaissent dans `status.sunrise` / `status.sunset`.
* **Le déclencheur manuel ignore tous les blocages** — si activé, le bouton et le point de données
  `feedNow` distribuent même en cas de blocage par température/fenêtre actif.

#### Alimentation dynamique

Optionnel : adapte l'**intervalle et la durée de l'alimentation à la température** via le modèle Q10 (le métabolisme double environ par +10 °C). Nécessite une source de température active ; les heures fixes sont alors remplacées par un intervalle dans la fenêtre.

* **Activer / source** – activez et choisissez la température de l'eau ou de l'air. Lorsqu'un second capteur d'eau (en profondeur) est configuré, la température de l'eau utilisée ici est combinée à partir des deux couches selon le mode de combinaison choisi (voir *Sources de température et d'oxygène*).
* **Référence / Q10** – l'intervalle et la durée de base s'appliquent à la température de référence (par ex. 20 °C) ; Q10 généralement 2–2,5 (le métabolisme double environ par +10 °C — voir *Alimentation dynamique — contexte & sources*).
* **Intervalle / durée (base, min, max)** – limites de l'intervalle calculé (minutes) et de la durée (secondes). L'**intervalle de base et l'intervalle maximal doivent être supérieurs à 0**, sinon aucune distribution ne peut être planifiée.
* **Fenêtre de moyenne / hystérésis** – une moyenne glissante (par ex. 24 h) lisse les pics ; l'hystérésis évite une replanification pour des variations infimes.

Les valeurs actuelles figurent dans `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` et `status.dynamicDurationSec`. Une source d'**oxygène (O₂)** facultative peut bloquer l'alimentation lorsque l'oxygène dissous passe sous un seuil. La pause hivernale est prioritaire sur l'alimentation dynamique.

> Si l'alimentation dynamique est activée mais qu'aucun intervalle valide ne peut être calculé (intervalle de base ou maximal à 0, ou une fenêtre horaire invalide), rien n'est planifié : `status.nextFeeding` reste vide et `status.blockReason` affiche une indication. Définissez un intervalle de base et un intervalle maximal supérieurs à 0.

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
| `status.waterTemperature` | number (ro) | Valeur de la source de température de l'eau propre à cet interrupteur (capteur de la zone d'alimentation / peu profond). |
| `status.waterTemperatureDeep` | number (ro) | Valeur du capteur de température de l'eau en profondeur optionnel de cet interrupteur. |
| `status.waterStratification` | number (ro) | Écart de température peu profonde − profonde (uniquement avec deux capteurs d'eau). |
| `status.oxygen` | number (ro) | Valeur de la source d'oxygène dissous propre à cet interrupteur. |
| `status.sunrise` / `status.sunset` | string (ro) | Lever/coucher du soleil calculé pour l'emplacement de cet interrupteur (fenêtre astronomique). |

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
* Sous *Restrictions*, active *Restreindre la distribution à la fenêtre diurne astronomique* afin
  que rien ne soit distribué après la tombée de la nuit.

**Volière, uniquement en journée (fenêtre astronomique)**
* Mode *Intervalle à l'intérieur d'une plage* → intervalle `90` min ; durée `3` s.
* Sous *Restrictions*, active la fenêtre astronomique avec des décalages de `30` / `30` min → la
  distribution se déroule de 30 min après le lever du soleil à 30 min avant le coucher du soleil,
  en suivant automatiquement les saisons.

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
`status.blocked` / `status.blockReason`) ; la **fenêtre astronomique** n'exclut pas cette heure ; règle le
**niveau de journal** de l'instance sur `debug` et observe le journal.

**La distribution n'a jamais lieu la nuit, alors que je le souhaite.**
Désactive *Restreindre la distribution à la fenêtre diurne astronomique* pour cet interrupteur, ou
ajuste ses décalages de lever/coucher du soleil. Si la fenêtre astronomique est activée mais que
l'interrupteur ne dispose pas de coordonnées valides, sa garde de fenêtre reste inactive et un
avertissement est journalisé.

**La surveillance signale toujours une anomalie.**
Ton objet interrupteur ne renvoie probablement pas son état réel (`ack=true`). Soit utilise un
interrupteur avec retour d'état, soit désactive la *Surveillance de la commutation* pour cet
interrupteur.

**L'alimentation dynamique ne change rien.**
Assure-toi que la source de température sélectionnée (eau ou air) est activée dans l'onglet de
l'interrupteur (*Sources de température et d'oxygène*) et fournit des valeurs. Juste après un
redémarrage, la moyenne glissante se remplit encore, elle part donc des valeurs de base. Surveille
`status.dynamicAvgTemperature` et `status.dynamicIntervalMin`.

**L'alimentation dynamique est activée mais rien n'est jamais distribué (`status.nextFeeding` est vide).**
L'**intervalle de base ou l'intervalle maximal est à 0** (ou la fenêtre horaire est invalide), aucun intervalle ne peut donc être calculé — `status.blockReason` affiche alors une indication. Définis un intervalle de base et un intervalle maximal supérieurs à 0 (et une fenêtre valide). Remarque : laisser à la fois l'intervalle minimal et maximal à 0 force également le résultat à 0.

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

## 11. Alimentation dynamique — contexte & sources

Les poissons (koïs, poissons rouges, carpes de bassin) sont **poïkilothermes (ectothermes)** : leur
métabolisme suit la température de l'eau. En règle générale, le taux métabolique **double environ à
chaque +10 °C**, ce qui correspond exactement au **coefficient Q10** (généralement 2–3) qu'utilise cet
adaptateur — nourrir plus souvent et un peu plus quand il fait chaud, et moins quand il fait froid, est
donc physiologiquement justifié.

**Recommandations pratiques de température (koïs / poissons de bassin) :**

* **en dessous d'environ 4–5 °C** — ne pas nourrir (utilise la *Pause hivernale*).
* **environ 4–10 °C** — à peine actifs ; nourrir rarement voire pas du tout, avec une nourriture
  facilement digestible (germe de blé).
* **environ 10–15 °C** — alimentation réduite ; le système immunitaire est encore faible (~12 °C).
* **environ 15–25 °C** — plage de croissance optimale, alimentation complète.
* **au-dessus d'environ 28 °C** — l'**oxygène** dissous devient le facteur limitant → le blocage par O₂
  est utile ici.

**Où mesurer, et pourquoi un second capteur :** la température qui compte est celle de l'eau que les
poissons occupent réellement (la **zone d'alimentation**), *pas* celle de la surface (qui peut s'écarter
de plusieurs degrés). Dans un bassin brassé par une pompe en marche, ou un bassin peu profond, un seul
capteur bien placé suffit. Ce n'est que dans un **bassin profond et non brassé** que l'eau se stratifie :
au-dessus de 4 °C, l'eau chaude reste en surface (plus froide en dessous) ; en dessous de 4 °C, cela
s'inverse, laissant un refuge à environ 4 °C près du fond. Là, un **second capteur (en profondeur)** apporte
une valeur ajoutée — pour la sécurité (nourrir selon la couche la plus froide), pour une bascule saisonnière
peu profonde/profonde, et pour rendre la stratification visible (`status.waterStratification`). Pour la
plupart des bassins, il est optionnel.

**Sources / pour aller plus loin :**

* Volkoff H. & Rønnestad I. (2020) : *Effects of temperature on feeding and digestive processes in fish.* Temperature 7(4):307–320. <https://pubmed.ncbi.nlm.nih.gov/33251280/>
* K.O.I. – *Water Temperature and Koi.* <https://koiorganisationinternational.org/koi-articles/water-temperature-and-koi>
* K.O.I. – *The Science behind Cold Water in Koi Ponds.* <https://koiorganisationinternational.org/koi-articles/science-behind-cold-water-koi-ponds>
* Pond Informer – *Koi feeding guide.* <https://pondinformer.com/koi-feeding-guide/>

> Ces chiffres sont des recommandations générales pour les koïs / poissons de bassin, et ne remplacent pas
> l'observation de tes propres animaux. Adapte la température de référence, le Q10, les limites et les seuils
> à ton espèce et à ton installation.

---

📖 [Documentation principale (anglais)](../../README.md)
