![Logo](../../admin/automatic-feeder.png)
# ioBroker.automatic-feeder

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

## Adaptador automatic-feeder para ioBroker

Este adaptador convierte cualquier interruptor de ioBroker ya existente (un enchufe, un relé, una
salida GPIO …) en un **comedero automático controlado por tiempo**. Enciende la salida a las horas
que tú definas durante una cantidad determinada de segundos y puede tener en cuenta la temperatura
así como el cambio día/noche, de modo que nunca se alimente en el momento equivocado.

Este documento es una guía completa. Si nunca has usado el adaptador, léelo de arriba a abajo: el
**Inicio rápido** te lleva en pocos minutos a la primera alimentación, y el resto explica cada
ajuste en detalle.

---

## Índice

1. [Qué hace el adaptador](#1-qué-hace-el-adaptador)
2. [Requisitos](#2-requisitos)
3. [Instalación](#3-instalación)
4. [Inicio rápido](#4-inicio-rápido--la-primera-alimentación)
5. [La página de ajustes en detalle](#5-la-página-de-ajustes-en-detalle)
6. [Objetos / puntos de datos](#6-objetos--puntos-de-datos)
7. [Ejemplos / recetas](#7-ejemplos--recetas)
8. [Notificaciones de Telegram](#8-notificaciones-de-telegram)
9. [Solución de problemas y preguntas frecuentes](#9-solución-de-problemas-y-preguntas-frecuentes)
10. [Registro y diagnóstico](#10-registro-y-diagnóstico)
11. [Alimentación dinámica — fundamentos y fuentes](#11-alimentación-dinámica--fundamentos-y-fuentes)
---

## 1. Qué hace el adaptador

Una «alimentación» es en esencia muy sencilla: **salida ENCENDIDA → esperar una cantidad ajustable
de segundos → APAGAR de nuevo**. En un comedero automático reconvertido, durante ese tiempo el
motor funciona y dispensa comida.

El adaptador gestiona **hasta 5 interruptores**, cada uno completamente independiente y con su propia
pestaña de configuración, denominada según el interruptor. Para cada interruptor defines:

* **cuándo** se alimenta: ya sea a **horas fijas** (p. ej. 08:00 y 18:00) o por **intervalo**
  dentro de una ventana de tiempo (p. ej. cada 60 minutos entre las 08:00 y las 18:00);
* **cuánto tiempo** permanece encendida la salida (duración de la alimentación en segundos);
* **si se bloquea** cuando la temperatura del agua o del aire es demasiado baja/alta;
* **si se restringe** la alimentación a la ventana astronómica del día (orto/ocaso con desfases
  por interruptor, desde una ubicación del sistema, compartida o por interruptor);
* **si se supervisa el proceso de conmutación** (comprobación de si realmente se encendió y
  apagó) y, opcionalmente, se envía un mensaje de **Telegram** con el resultado;
* **si se reduce o pausa** la alimentación durante una temporada de **invierno** recurrente,
  opcionalmente con recordatorios de Telegram antes de que empiece y termine;
* **si se adapta** el intervalo y la ración a la temperatura del agua/aire automáticamente
  (**alimentación dinámica**, modelo Q10);
* **si se bloquea** la alimentación cuando el **oxígeno** disuelto (O₂) es demasiado bajo;
* **hasta 3 pausas de alimentación puntuales** (periodos absolutos de fecha y hora, p. ej. una
  cuarentena tras un repoblado) con un mensaje de **Telegram** al inicio y al final de cada una;
* un **interruptor principal de pausa** (*Suspender alimentación ahora*) que suspende al instante
  **toda** la alimentación de un interruptor hasta que lo vuelvas a apagar, con un mensaje de
  **Telegram** en cada cambio.

Puedes activar una alimentación **manualmente** en cualquier momento: directamente en la página de
ajustes (botón con duración de libre elección) o mediante un punto de datos (p. ej. un botón en una
vista de VIS).

Opcionalmente, el adaptador integra la **placa de relé Automatic-Feeder** (un ESP32 con tres botones
temporizadores y su propia interfaz web). Tú decides **por interruptor** si este usa una placa de este
tipo; cuando la activas para un interruptor en los ajustes generales, ese interruptor recibe una pestaña
**Relé** en la que estableces la dirección de red de la placa, pruebas la conexión y configuras sus tres
tiempos de alimentación de los botones (S1–S3) directamente desde el adaptador.

> Importante: el adaptador no crea el interruptor por sí mismo. **Controla un objeto ya existente**
> en tu ioBroker. Ese objeto lo seleccionas en la configuración.

---

## 2. Requisitos

| Necesitas | Detalles |
|-------------|---------|
| **ioBroker** con **admin** actual (≥ 7) | La página de configuración está implementada con React. |
| **Un objeto interruptor** | Un punto de datos de ioBroker escribible que encienda/apague el comedero automático, p. ej. un enchufe (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), un relé o una variable de script. |
| *(opcional)* **Coordenadas geográficas** | Se usan para calcular el orto y el ocaso de la **ventana astronómica** por interruptor. Solo se necesitan si algún interruptor usa esa ventana; se toman de los ajustes del sistema de ioBroker, de una posición compartida o se configuran por interruptor. |
| *(opcional)* Objetos de temperatura | Puntos de datos existentes con la temperatura del aire o del agua, para el bloqueo por temperatura o la alimentación dinámica. Se asignan **por interruptor** en la pestaña del interruptor. |
| *(opcional)* Objetos de **oxígeno (O₂)** | Puntos de datos existentes con el oxígeno disuelto, para bloquear la alimentación cuando cae demasiado bajo. Se asignan **por interruptor**. |
| *(opcional)* Una instancia de **Telegram** | El adaptador oficial `telegram`, configurado e iniciado, si quieres notificaciones push. |
| Acceso a Internet en el host de ioBroker | Solo para la búsqueda de direcciones/mapa en la configuración. El funcionamiento normal se realiza sin conexión. |

---

## 3. Instalación

1. En el **admin** de ioBroker, abre la pestaña **Adaptadores** (Adapter).
2. Busca **automatic-feeder** en la lista de adaptadores y haz clic en **Instalar**.
3. Crea una **instancia** del adaptador.
4. Abre los ajustes de la instancia (icono de engranaje): debería aparecer la página de
   configuración con la pestaña **Ajustes básicos** (Grundeinstellungen). Si permanece vacía,
   consulta [Solución de problemas](#9-solución-de-problemas-y-preguntas-frecuentes).

---

## 4. Inicio rápido – la primera alimentación

Objetivo: que un interruptor alimente, de inmediato y a modo de prueba, durante 5 segundos.

1. **Abre los ajustes** de la instancia de automatic-feeder.
2. En la pestaña **Ajustes básicos** (Grundeinstellungen):
   * En **Ubicación** (Standort), deja seleccionada *Usar los ajustes del sistema para todos los
     interruptores* (solo relevante si más adelante activas la ventana astronómica). También puedes
     elegir una ubicación compartida o configurarla por interruptor.
   * Desplázate hacia abajo hasta **Interruptores** (Schalter) y haz clic en **Añadir interruptor**.
   * Asigna un **nombre** (p. ej. `Koi-Teich`). Este nombre pasa a ser el título de una pestaña
     propia.
   * Junto a **Objeto interruptor** (Schalter-Objekt), haz clic en el icono de lista y elige el
     punto de datos que conmuta tu comedero (p. ej. tu enchufe). El interruptor debe estar
     **activo** (casilla a la izquierda).
3. **Guarda** (disquete/marca de verificación abajo). Aparece una nueva pestaña con el nombre de tu
   interruptor.
4. Abre esa **pestaña del interruptor**. Arriba del todo, en **Alimentación manual**, ajusta una
   duración (p. ej. `5` segundos) y haz clic en **Alimentar ahora**. La salida debería encenderse
   durante 5 segundos y luego apagarse de nuevo.
5. En la misma pestaña, configura el horario real en **Plan de alimentación** (p. ej. horas fijas
   08:00 y 18:00) y establece la **duración de la alimentación** en **Proceso de alimentación**,
   luego **Guarda**.

Listo: a partir de ahora el adaptador alimenta automáticamente. Todo lo demás explica las opciones
en detalle.

---

## 5. La página de ajustes en detalle

La configuración tiene una pestaña **Ajustes básicos** (Grundeinstellungen) así como **una pestaña
por interruptor** (se crea automáticamente en cuanto un interruptor tiene un nombre). Si una página
no se desplaza, agranda la ventana o usa la barra de desplazamiento de la derecha: todas las
secciones son accesibles.

### 5.1 Pestaña «Ajustes básicos» (Grundeinstellungen)

#### Ubicación (para la ventana astronómica)

La ubicación se usa para calcular el orto y el ocaso de la **ventana astronómica de alimentación**
que se puede activar por interruptor (consulta *Restricciones* en la pestaña del interruptor). Solo
se necesita si al menos un interruptor usa esa ventana. Tres opciones:

* **Usar los ajustes del sistema para todos los interruptores**: toma la latitud/longitud de la
  configuración del sistema de ioBroker (recomendado si ya está establecida allí). Se muestran los
  valores actuales.
* **Una ubicación compartida para todos los interruptores**: establece una única posición que usan
  todos los interruptores:
  * Introduce una **dirección** y pulsa **Buscar**. El adaptador la resuelve (mediante
    OpenStreetMap / Nominatim) y coloca un marcador.
  * O bien **haz clic en el mapa** / **arrastra el marcador** para elegir el punto exacto.
  * La latitud/longitud también se pueden introducir directamente; el mapa las sigue.
* **Configurar la ubicación individualmente por interruptor**: cada interruptor define su propia
  ubicación en su propia pestaña (útil cuando las estaciones de alimentación, p. ej. estanques,
  están en lugares diferentes).

> La búsqueda de direcciones se ejecuta en el backend del adaptador, por lo que la **instancia debe
> estar en ejecución**. El mapa y la búsqueda requieren acceso a Internet.

Los **desfases de orto/ocaso se configuran por interruptor** (en *Restricciones*), y las horas
calculadas se publican por interruptor como `status.sunrise` / `status.sunset`, recalculadas
automáticamente cada noche.

#### Interruptores

La lista de comederos automáticos (hasta 5). Por cada entrada:

* **Activo** (casilla): solo se planifican los interruptores activos.
* **Nombre**: texto libre; pasa a ser el título de la pestaña del interruptor y el nombre del canal
  en el árbol de objetos.
* **Objeto interruptor** (Schalter-Objekt): el punto de datos de ioBroker existente que se controla.
  Selecciónalo mediante el icono de lista; vacíalo con la cruz.

Con **Añadir interruptor** creas uno más (máx. 5); con el icono de la papelera eliminas uno. Al
eliminarlo también se borran sus puntos de datos.

* **Este interruptor usa la placa de relé Automatic-Feeder (añade una pestaña de relé)** (conmutador)
  – actívalo solo para un interruptor cuya estación de alimentación use la placa de relé Automatic-Feeder
  opcional (ESP32). Cuando está activado, ese interruptor recibe una pestaña **Relé** adicional (consulta
  la sección 5.3).

### 5.2 Pestañas de interruptor

Cada interruptor configurado recibe su propia pestaña con su nombre. Contiene las siguientes
secciones.

#### Alimentación manual

* **Duración de la alimentación manual (segundos)**: la duración que utiliza el botón.
* **Alimentar ahora**: activa de inmediato una alimentación con esa duración. Práctico para probar o
  para una ración extra. (Que se ignoren los bloqueos depende de *El activador manual ignora todos
  los bloqueos* en *Restricciones*.)
* Para el botón, la instancia debe estar en ejecución y la configuración **guardada**.

#### Plan de alimentación

Elige **un** modo:

* **Horas fijas**: una lista de horas (`HH:mm`). Añade tantas como quieras; el comedero funciona a
  diario a cada una de ellas. Ejemplo: `08:00` y `18:00`.
* **Intervalo dentro de un periodo**: alimentar repetidamente dentro de una ventana:
  * **Inicio del periodo** / **Fin del periodo**: p. ej. de 08:00 a 18:00.
  * **Intervalo (minutos)**: p. ej. 60 → alimenta a diario a las 08:00, 09:00, … hasta el final de
    la ventana.

Si la **ventana astronómica** está activada (consulta *Restricciones*), el inicio/fin fijos de la
ventana se sustituyen por la ventana de orto/ocaso y se ocultan; el intervalo se ejecuta entonces
entre el orto y el ocaso. La siguiente hora planificada figura en todo momento en el punto de datos
`status.nextFeeding`.

#### Proceso de alimentación

* **Duración de la alimentación (segundos)**: cuánto tiempo permanece ENCENDIDA la salida en una
  alimentación planificada.
* **Valor de encendido** / **Valor de apagado**: los valores que se escriben en el objeto
  interruptor. Por defecto son `true` y `false`, lo que encaja con la mayoría de enchufes/relés. Si
  tu dispositivo espera números o texto, introduce aquí p. ej. `1` / `0` o `ON` / `OFF`.

#### Fuentes de temperatura y oxígeno

Cada interruptor (estación de alimentación) tiene **sus propios** sensores: distintos
estanques/depósitos pueden usar objetos diferentes:

* **Temperatura del aire**: marca la casilla y elige el punto de datos que contiene la temperatura
  del aire de esta estación.
* **Temperatura del agua**: marca la casilla y elige el punto de datos que contiene la temperatura
  del agua de esta estación. Es el sensor primario de la **zona de alimentación** (colócalo donde
  los peces comen realmente, no en la superficie).
* **Temperatura del agua (profunda)**: *segundo sensor opcional* de agua (p. ej. cerca del fondo).
  Solo se muestra una vez activado el sensor de agua primario. Con dos sensores eliges un **modo de
  combinación** para la alimentación dinámica: *Zona de alimentación (solo superficial)* [por
  defecto], *Promedio de ambos*, *Capa más fría* o *Estacional* (usa el sensor superficial mientras
  esté por encima o igual a un umbral, y en caso contrario el sensor profundo). El **bloqueo** por
  temperatura usa siempre la **capa más fría** de las dos. Un segundo sensor solo aporta valor en
  **estanques profundos y sin mezcla** (una bomba en marcha mezcla el agua y elimina cualquier
  estratificación); consulta *Alimentación dinámica — fundamentos y fuentes*.
* **Oxígeno (O₂)**: marca la casilla y elige el punto de datos que contiene el oxígeno disuelto.

Solo tienen sentido los puntos de datos numéricos. Los valores actuales se reflejan en los puntos de
datos `status.airTemperature`, `status.waterTemperature`, `status.waterTemperatureDeep`,
`status.oxygen` (y `status.waterStratification` = superficial − profunda) de este interruptor. Los
umbrales se establecen más abajo (*Bloqueo por temperatura*), y las temperaturas también alimentan la
*Alimentación dinámica*.

#### Bloqueo por temperatura

Solo se muestra para las fuentes de temperatura activadas más arriba (*Fuentes de temperatura y
oxígeno*). Por cada interruptor:

* **Bloquear según la temperatura del agua**: *Bloquear si está por debajo de* o *Bloquear si está
  por encima de* (°C).
* **Bloquear según la temperatura del aire**: lo mismo para el aire.

Si la temperatura actual está fuera del rango permitido, la alimentación se omite y el motivo se
escribe en `status.blockReason`. (Si un valor de temperatura es desconocido, esa fuente no bloquea.)

#### Restricciones

* **Restringir la alimentación a la ventana astronómica del día (orto/ocaso + desfases)**: cuando
  está activo, la alimentación se limita a la ventana diurna calculada a partir de la ubicación de
  este interruptor. Para *Intervalo* y *Alimentación dinámica* esta ventana sustituye el inicio/fin
  fijos de la ventana; para *Horas fijas* actúa como guardián día/noche (se omiten las horas fuera
  de la ventana). Cuando está activado puedes ajustar:
  * **Minutos después del orto**: empezar tantos minutos *después* del orto (0 por defecto).
  * **Minutos antes del ocaso**: parar tantos minutos *antes* del ocaso (0 por defecto).
  * **Ubicación para este interruptor**: solo se muestra cuando la *Ubicación* general está en
    *individual*: elige *Usar los ajustes del sistema* o *Establecer ubicación específica* (búsqueda
    de direcciones + mapa) para este interruptor. Las horas calculadas aparecen en `status.sunrise`
    / `status.sunset`.
* **El activador manual ignora todos los bloqueos**: si está activo, el botón y los puntos de datos
  `feedNow` / `feedFor` alimentan incluso con un bloqueo por temperatura/ventana activo.

#### Alimentación dinámica

Opcional: adapta el **intervalo y la duración de la alimentación a la temperatura** con el modelo Q10 (el metabolismo casi se duplica por cada +10 °C). Requiere una fuente de temperatura activa; los horarios fijos se sustituyen entonces por un intervalo dentro de la ventana.

* **Activar / fuente** – actívalo y elige la temperatura del agua o del aire. Cuando hay configurado un segundo sensor de agua (profundo), la temperatura del agua utilizada aquí se combina a partir de ambas capas según el modo de combinación elegido (consulta *Fuentes de temperatura y oxígeno*).
* **Referencia / Q10** – el intervalo y la duración base se aplican a la temperatura de referencia (p. ej. 20 °C); Q10 normalmente 2–2,5 (el metabolismo casi se duplica por cada +10 °C — consulta *Alimentación dinámica — fundamentos y fuentes*).
* **Intervalo / duración (base, mín, máx)** – límites para el intervalo calculado (minutos) y la duración (segundos). El **intervalo base y el intervalo máximo deben ser mayores que 0**, de lo contrario no se puede planificar ninguna alimentación.
* **Ventana de promedio / histéresis** – una media móvil (p. ej. 24 h) suaviza los picos; la histéresis evita replanificar por cambios mínimos.

Los valores actuales están en `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` y `status.dynamicDurationSec`. Una fuente opcional de **oxígeno (O₂)** puede bloquear la alimentación cuando el oxígeno disuelto cae por debajo de un umbral. La pausa de invierno tiene prioridad sobre la alimentación dinámica.

> Si la alimentación dinámica está activada pero no se puede calcular ningún intervalo válido (el intervalo base o máximo es 0, o una ventana de tiempo no válida), no se planifica nada: `status.nextFeeding` permanece vacío y `status.blockReason` muestra una indicación. Establece un intervalo base y un intervalo máximo mayores que 0.

#### Pausa de invierno

Para cada interruptor puedes definir una **pausa de invierno** recurrente (estacional, como fechas `MM-DD` que se repiten cada año y pueden cruzar el Año Nuevo).

* **Activar la pausa de invierno** – activar la pausa.
* **Inicio / Fin del invierno** – elige el día y el mes en un calendario (se muestra como dd.mm), p. ej. del 01.11 al 15.03.
* **Modo** – durante la pausa, **suspender la alimentación**, alimentar con un intervalo propio **reducido** o **una vez al día** a una hora fija; se aplica una **duración de alimentación de invierno** propia.
* **Recordatorios (Telegram)** – en los días previos al inicio y al fin se envía cada día (la última vez el mismo día) un recordatorio a la hora configurada. Necesita una instancia de Telegram (ver abajo).

El estado actual se muestra en el punto de datos `status.winterActive`. La alimentación se reanuda automáticamente al terminar la pausa.

#### Pausas de alimentación

**Suspender alimentación ahora (interruptor principal).** En la parte superior de esta sección, un
único **interruptor de encendido/apagado** te permite suspender **toda** la alimentación del
interruptor **de forma inmediata e indefinida**: anula las pausas temporales de más abajo **y** todos
los modos de alimentación (horas fijas, intervalo, alimentación dinámica, pausa de invierno). Vuelve a
**apagarlo** y la alimentación se reanuda exactamente como estaba configurada antes; no hay que cambiar
nada más. Al cambiarlo se envía un mensaje de **Telegram** (*encendido* / *apagado*). Uso típico: una
interrupción espontánea (medicación, mantenimiento, tratamiento del agua) sin tocar ningún horario. Se
puede editar desde la página de ajustes **y desde VIS/scripts** mediante `settings.pauseNow`, y su
estado en vivo se muestra en `status.pauseManual`.

Por debajo del interruptor principal, hasta **3 pausas de alimentación puntuales** por interruptor te
permiten planificar periodos absolutos de fecha y hora en los que la alimentación queda **completamente
suspendida** (mayor prioridad que cualquier modo de alimentación). Uso típico: una **cuarentena tras un
repoblado**, cuando los peces nuevos no deben alimentarse durante un tiempo.

* **Pausa 1 / 2 / 3** – marca la casilla para activarla y elige un **Inicio** y un **Fin** (fecha +
  hora, se muestra como `DD.MM.YYYY HH:mm`), p. ej. de `15.07.2026 08:00` a `22.07.2026 18:00`.
* La alimentación se detiene mientras *ahora* está dentro de una pausa activada y se reanuda
  automáticamente al terminar.
* Se envía un mensaje de **Telegram** justo al **inicio** y al **final** de cada pausa (necesita una
  instancia de Telegram, ver abajo). Si el adaptador se inicia mientras una pausa ya está activa,
  solo se envía el mensaje de *fin*.
* Editable desde la página de ajustes **y desde VIS/scripts** mediante los puntos de datos
  `settings.*` (p. ej. `settings.pause1Start`).

El estado actual se muestra en `status.pauseActive` y `status.pauseActiveUntil` (el interruptor
principal también actúa sobre `status.pauseActive`).

#### Supervisión de la conmutación

Tras la conmutación, el adaptador puede comprobar si el interruptor ha alcanzado **realmente** el
estado de encendido y apagado, y notifica por cada alimentación uno de tres resultados:

| Resultado | Significado | Mensaje |
|----------|-----------|---------|
| ✅ Éxito | El interruptor se encendió y apagó como se esperaba | „Alimentación activada durante x s." |
| ❌ Encendido fallido | El interruptor nunca confirmó el estado de ENCENDIDO | „No se pudo realizar la alimentación. ¡Compruebe el interruptor!" |
| ❌ Apagado fallido | Se encendió, pero no volvió a apagarse | „Avería: ¡el comedero no se apagó!" |

> El mensaje se envía en el idioma del sistema de ioBroker configurado (inglés de forma predeterminada).


* **Comprobar si el interruptor realmente se enciende y apaga**: activa la supervisión.
* **Tiempo de espera de la supervisión (segundos)**: cuánto tiempo se espera la confirmación.
* **Intentos de verificación**: cuántas recomprobaciones escalonadas se realizan antes de informar de una avería (3 por defecto). Cada intento también vuelve a leer el estado actual, de modo que una respuesta retardada (p. ej., radio Homematic) ya no provoca una avería falsa.

> **Importante:** la supervisión solo funciona si el interruptor **informa de su estado real**, es
> decir, si el objeto de destino se actualiza con `ack=true` (típico de enchufes/relés con
> retroalimentación de estado). Un simple booleano auxiliar que nadie confirma notificaría siempre
> una avería; en ese caso, desactiva la supervisión para ese interruptor.

El resultado figura además en los puntos de datos `status.lastResult` (texto) y `status.error` (booleano), de modo
que puedas reaccionar ante él (p. ej. activar una notificación propia).

#### Notificaciones de Telegram

Envía los mensajes de la supervisión de la conmutación a Telegram, configurado **por interruptor**:

* **Idioma de los mensajes**: el idioma de todos los textos salientes de este interruptor (Telegram,
  Sayit y el anuncio de alimentación), ya sea *Idioma del sistema* (el idioma del sistema de
  ioBroker) o un idioma concreto. Los puntos de datos de estado no se ven afectados.
* **Instancia de Telegram**: elige una de las instancias `telegram.*` instaladas (o *Ninguna*, para
  desactivar Telegram en ese interruptor). Si no hay ninguna instalada, el campo lo indica.
* **Destinatario de Telegram (opcional)**: un nombre concreto de usuario/chat, tal como está
  configurado en el adaptador de telegram; déjalo vacío para enviar a todos los destinatarios
  configurados.
* **Casillas de verificación**: selecciona qué mensajes se envían: alimentación exitosa, no
  realizable o avería del apagado.

Los **recordatorios de la pausa de invierno** (si están activados, consulta *Pausa de invierno*) se
envían a la misma instancia de Telegram, con independencia de estas casillas de supervisión.

La configuración completa se encuentra en [Notificaciones de Telegram](#8-notificaciones-de-telegram).

#### Notificaciones de Sayit

Pronuncia por voz los mismos mensajes de la supervisión de la conmutación mediante una instancia de
**Sayit (texto a voz)**, configurada **por interruptor**, con independencia de Telegram (ambos
pueden estar activos a la vez):

* **Instancia de Sayit** – elige una de las instancias `sayit.*` instaladas (o *Ninguna*, para
  desactivar Sayit en ese interruptor). Si no hay ninguna instalada, el campo lo indica.
* **Volumen (0-100, opcional)** – el volumen de voz de este interruptor; déjalo vacío para usar el
  valor predeterminado de la propia instancia de Sayit.
* **Probar anuncio** – junto a la selección de instancia: pronuncia un breve texto de prueba a
  través de la instancia seleccionada para que puedas comprobar la salida de audio de inmediato,
  sin esperar a una alimentación.
* **Casillas de verificación** – selecciona qué mensajes se pronuncian: alimentación exitosa, no
  realizable o avería del apagado (las mismas tres que en Telegram, pero aquí se seleccionan por
  separado).

El texto hablado usa el **Idioma de los mensajes** seleccionado en la sección de Telegram de arriba.

#### Anuncio de alimentación

Anuncia una alimentación próxima con una antelación configurable, mediante Telegram o Sayit:

* **Anunciar la alimentación con antelación** – activa el anuncio.
* **Antelación (minutos)** – cuánto tiempo antes de la alimentación se envía el anuncio (p. ej. `5`).
* **Anunciar por Telegram** / **Anunciar por Sayit** – el canal o los canales que se usan para el
  anuncio (cada uno necesita su instancia configurada arriba).

El anuncio se planifica junto con cada alimentación. Si, en el momento del anuncio, la alimentación
fuera a estar **bloqueada o en pausa** (noche, temperatura, oxígeno o una pausa de alimentación), el
anuncio se omite, de modo que nunca promete una alimentación que no vaya a producirse. Las
alimentaciones manuales (el botón *Alimentar ahora* / `feedFor`) no tienen antelación y no se
anuncian.

### 5.3 Pestaña de la placa de relé (opcional)

Esta pestaña solo aparece cuando el conmutador por interruptor **Este interruptor usa la placa de relé
Automatic-Feeder …** de este interruptor está activado en los ajustes generales (consulta la sección 5.1).
Cada placa de relé pertenece a un interruptor (estación de alimentación). La placa es un ESP32 con
tres botones temporizadores (S1–S3) y su propia interfaz web, accesible a través de tu red en el
**puerto 80**. El adaptador solo **configura** la placa y **muestra su estado**; no activa la
alimentación a través de la placa (los botones se accionan en la propia placa).

* **Dirección de la placa (IP o host mDNS)** – p. ej. `192.168.1.50` o `feeder.local`. Una IP fija
  es lo más fiable; mDNS (`.local`) solo funciona si tu sistema anfitrión puede resolverlo. Se admite
  un sufijo `:port`, pero normalmente no es necesario (por defecto `80`).
* **Probar conexión y obtener tiempos** – contacta con la placa una vez. Un indicador verde
  *Conectado* y el host/IP/firmware de la placa confirman una conexión correcta; los tres tiempos de
  alimentación de los botones se leen entonces de la placa en los campos de más abajo. Un indicador
  rojo *No conectado* muestra el error.
* **Tiempos de alimentación de los botones (segundos)** – el tiempo de alimentación de cada botón
  **S1**, **S2** y **S3** (1–600 s). Como estos **también se pueden editar en la propia interfaz web
  de la placa**, primero *obtenlos* siempre y luego ajústalos.
* **Guardar tiempos en la placa** – escribe los tres valores en la placa.
* **Reiniciar placa** – reinicia el ESP32 a través de su API (`POST /api/reboot`). Tras una
  solicitud de confirmación, la placa se reinicia y queda fuera de línea durante unos segundos, tras
  lo cual vuelve automáticamente.

En la parte inferior de la pestaña, un **Resumen del sistema** muestra los datos del sistema en
tiempo real de la placa tras una prueba de conexión correcta (el botón *Probar conexión y obtener
tiempos*): versión del firmware, nombre del host, dirección IP, red Wi-Fi, intensidad de la señal
(dBm), dirección MAC, tiempo de actividad, memoria libre y el último motivo de reinicio.

La conexión también se refleja en el árbol de objetos y se actualiza cada 60 s – consulta los puntos
de datos `relay.*` en la sección 6.

---

## 6. Objetos / puntos de datos

> **Nota:** todos los puntos de datos con marca de tiempo se muestran en la **zona horaria local del sistema** (formato `DD.MM.AAAA HH:MM:SS`, p. ej. `01.07.2026 16:20:00`). Para VIS y scripts, cada marca de tiempo tiene además un **gemelo numérico** que termina en `…Ts` (tiempo Unix en **milisegundos**, `0` = ninguno): ideal para cuentas atrás y barras de tiempo sin analizar cadenas de texto, e independiente del formato de visualización.

El adaptador crea los siguientes puntos de datos en su espacio de nombres
(`automatic-feeder.<instanz>.`).

**Global**

| Punto de datos | Tipo | Significado |
|------------|-----|-----------|
| `info.connection` | boolean (ro) | El adaptador está en ejecución y la configuración es válida. |

**Por interruptor bajo `switches.<id>.`** (`<id>` es un ID interno como `sw-0`)

Directamente bajo el interruptor están el activador manual y dos subcanales:

* **`status`** (`switches.<id>.status.*`) – los puntos de datos de estado de solo lectura que se
  enumeran a continuación.
* **`settings`** (`switches.<id>.settings.*`) – un reflejo **editable** de la configuración de
  este interruptor. Al escribir un nuevo valor ahí (desde VIS o un script) se cambia la
  configuración y se reinicia la instancia para que el cambio surta efecto. Unos pocos campos
  derivados son de solo lectura (p. ej. `winterWindow`).
* **`relay`** (`switches.<id>.relay.*`) – presente solo cuando este interruptor usa una placa de relé;
  los puntos de datos de estado de la placa de relé, de solo lectura, que se enumeran al final de la
  tabla.

| Punto de datos | Tipo | Significado |
|------------|-----|-----------|
| `feedNow` | boolean (rw) | Escribir `true` para alimentar manualmente. |
| `feedFor` | number (rw) | Escribir una duración en **segundos** para activar **una alimentación con exactamente esa duración**: sin cambio de configuración, sin reinicio. Se restablece a `0` tras la ejecución. |
| `status.feedingActive` | boolean (ro) | En este momento hay una alimentación en curso. |
| `status.feedingEndsTs` | number (ro) | Fin de la alimentación **en curso** como tiempo Unix en ms (`0` = sin alimentar) — para una cuenta atrás del tiempo de ejecución en vivo (p. ej. 15 → 0 s) en VIS. |
| `status.feedingDurationSec` | number (ro) | Duración total de la alimentación **en curso** en segundos (`0` = sin alimentación) — permite que un widget VIS dibuje un anillo de progreso exacto junto a la cuenta atrás. |
| `status.lastFeeding` | string (ro) | Momento de la última alimentación. |
| `status.lastFeedingTs` | number (ro) | Última alimentación como tiempo Unix en ms (`0` = todavía ninguna). |
| `status.nextFeeding` | string (ro) | Momento de la próxima alimentación planificada. |
| `status.nextFeedingTs` | number (ro) | Próxima alimentación planificada como tiempo Unix en ms (`0` = nada planificado). |
| `status.blocked` | boolean (ro) | El último intento estaba bloqueado. |
| `status.blockReason` | string (ro) | Motivo del bloqueo (noche / temperatura / oxígeno), en el idioma del sistema. |
| `status.blockReasonCode` | string (ro) | El motivo del bloqueo como **código estable legible por máquina** (p. ej. `blockNight`, `blockWaterBelow`, `blockPauseManual`; vacío = no bloqueado): para la lógica de iconos/colores en VIS, independiente del idioma. |
| `status.lastResult` | string (ro) | Texto del resultado del último intento de alimentación. |
| `status.error` | boolean (ro) | El último intento tuvo una avería de conmutación. |
| `status.winterActive` | boolean (ro) | La pausa de invierno está activa actualmente. |
| `status.winterLastStartReminder` | string (ro) | Fecha del último recordatorio «empieza el invierno» enviado. |
| `status.winterLastEndReminder` | string (ro) | Fecha del último recordatorio «termina el invierno» enviado. |
| `status.pauseManual` | boolean (ro) | La pausa principal manual (*Suspender alimentación ahora* / `settings.pauseNow`) está activada. |
| `status.pauseActive` | boolean (ro) | Una pausa de alimentación puntual está activa actualmente. |
| `status.pauseActiveUntil` | string (ro) | Fin de la pausa de alimentación activa actualmente (vacío si no hay ninguna). |
| `status.pauseActiveUntilTs` | number (ro) | Fin de la pausa de alimentación activa como tiempo Unix en ms (`0` = ninguna). |
| `status.dynamicAvgTemperature` | number (ro) | Temperatura promediada usada por la alimentación dinámica. |
| `status.dynamicRate` | number (ro) | Factor de tasa Q10 aplicado actualmente por la alimentación dinámica. |
| `status.dynamicIntervalMin` | number (ro) | Intervalo dinámico calculado actualmente (minutos). |
| `status.dynamicDurationSec` | number (ro) | Duración dinámica calculada actualmente (segundos). |
| `status.airTemperature` | number (ro) | Valor de la fuente de temperatura del aire propia de este interruptor. |
| `status.waterTemperature` | number (ro) | Valor de la fuente de temperatura del agua propia de este interruptor (sensor de la zona de alimentación / superficial). |
| `status.waterTemperatureDeep` | number (ro) | Valor del sensor opcional de temperatura del agua profunda de este interruptor. |
| `status.waterStratification` | number (ro) | Diferencia de temperatura superficial − profunda (solo con dos sensores de agua). |
| `status.oxygen` | number (ro) | Valor de la fuente de oxígeno disuelto propia de este interruptor. |
| `status.sunrise` / `status.sunset` | string (ro) | Orto/ocaso calculados para la ubicación de este interruptor (ventana astronómica). |
| `status.sunriseTs` / `status.sunsetTs` | number (ro) | Orto/ocaso como tiempo Unix en ms, p. ej. para una barra de progreso del día en VIS. |
| `relay.connected` | boolean (ro) | La placa de relé configurada para este interruptor es accesible (solo cuando este interruptor usa una placa de relé). |
| `relay.info` | string (ro) | Identidad de la placa de relé (host / IP / firmware) del último sondeo correcto. |
| `relay.active` | boolean (ro) | El temporizador de la placa de relé está en marcha actualmente. |
| `relay.remaining` | number (ro) | Segundos restantes del temporizador en marcha de la placa de relé. |

Estos puntos de datos pueden utilizarse en VIS, scripts u otros adaptadores, p. ej. mostrar
`status.nextFeeding` en un panel o activar una alarma propia cuando `status.error = true`.

---

## 7. Ejemplos / recetas

**Estanque de koi, dos veces al día, solo con suficiente calor**
* Modo *Horas fijas* → `08:00`, `18:00`; duración `6` s.
* En la pestaña del interruptor, en *Fuentes de temperatura y oxígeno*, activa *Temperatura del
  agua* y elige el sensor; luego *Bloquear según la temperatura del agua* → *Bloquear si está por
  debajo de* `8` °C (sin alimentación con el agua demasiado fría).
* En *Restricciones*, activa *Restringir la alimentación a la ventana astronómica del día* para que
  no se alimente después del anochecer.

**Aviario, solo durante el día (ventana astronómica)**
* Modo *Intervalo dentro de un periodo* → intervalo `90` min; duración `3` s.
* En *Restricciones*, activa la ventana astronómica con desfases de `30` / `30` min → la
  alimentación se ejecuta desde 30 min después del orto hasta 30 min antes del ocaso, siguiendo las
  estaciones automáticamente.

**Estanque de koi, adaptado a la temperatura (alimentación dinámica)**
* En la pestaña del interruptor, en *Fuentes de temperatura y oxígeno*, activa *Temperatura del
  agua* y elige el sensor.
* En la pestaña del interruptor abre *Alimentación dinámica*, actívala, fuente *Temperatura del agua*.
* Referencia `20` °C, Q10 `2,2`, intervalo base `60` min (mín `30`, máx `480`), duración base `5` s
  (mín `2`, máx `15`). Entonces alimenta más a menudo y un poco más cuando hace calor, y menos cuando
  hace frío.

**Descanso invernal para el estanque**
* En la pestaña del interruptor abre *Pausa de invierno*, actívala, establece *Inicio del invierno*
  `01.11` y *Fin del invierno* `15.03`, modo *Suspender la alimentación*.
* Opcionalmente marca los recordatorios para recibir un aviso de Telegram unos días antes del
  inicio/fin.

**Cuarentena tras un repoblado (pausa de alimentación)**
* En la pestaña del interruptor abre *Pausas de alimentación*, marca *Pausa 1* y establece *Inicio*
  `15.07.2026 08:00`, *Fin* `22.07.2026 18:00` → no se alimenta en absoluto en esa ventana, luego se
  reanuda automáticamente.
* Con una instancia de Telegram configurada recibes un mensaje al inicio y al final de la pausa.

**Suspender la alimentación ahora mismo (interruptor principal)**
* En la pestaña del interruptor abre *Pausas de alimentación* y activa *Suspender alimentación ahora*
  – o escribe `true` en `automatic-feeder.0.switches.sw-0.settings.pauseNow` desde un interruptor de VIS.
* Toda la alimentación se detiene de inmediato (anulando todos los modos) hasta que lo vuelvas a
  apagar; cada cambio envía un mensaje de Telegram. `status.pauseManual` muestra el estado en vivo.

**Ración extra manual mediante un botón de VIS**
* Crea en VIS un botón que escriba `true` en `automatic-feeder.0.switches.sw-0.feedNow`.
* O usa un deslizador/campo numérico que escriba los **segundos** en
  `automatic-feeder.0.switches.sw-0.feedFor` → alimenta **una vez con exactamente esa duración**
  (sin cambio de configuración, sin reinicio; el punto de datos se restablece a `0` después).
* Opcionalmente activa *El activador manual ignora todos los bloqueos* para que siempre se alimente.

---

## 8. Notificaciones de Telegram

1. Instala y configura el adaptador **telegram** (crea un bot con @BotFather, introduce el token,
   inicia un chat con el bot). La instancia de Telegram debe estar **en ejecución**.
2. En una **pestaña de interruptor** de automatic-feeder, abre la sección **Notificaciones de
   Telegram**:
   * Selecciona la **instancia de Telegram** en el desplegable (p. ej. `telegram.0`).
   * Opcionalmente, introduce un **destinatario** (el nombre de usuario/chat que se muestra en el
     adaptador de telegram); déjalo vacío para notificar a todos.
   * Marca los mensajes deseados: *alimentación exitosa*, *no realizable*, *avería del apagado*.
3. Guarda. A partir de ahora, los resultados de supervisión elegidos se envían a Telegram (con el
   nombre del interruptor delante). El requisito es que la *supervisión de la conmutación* esté
   activada para ese interruptor.
4. Los **recordatorios de la pausa de invierno** usan la misma instancia de Telegram y el mismo
   destinatario. Se controlan en la sección *Pausa de invierno* (días antes del inicio/fin y la hora
   del recordatorio) y **no** requieren que la supervisión esté activada.

---

## 9. Solución de problemas y preguntas frecuentes

**La página de ajustes está vacía / en blanco.**
Recarga el navegador con **Ctrl+Shift+R**. Si el problema persiste, reinicia la instancia y vuelve a
abrir los ajustes.

**El nuevo icono / un cambio no aparece.**
Caché del navegador. Recarga de forma forzada con **Ctrl+Shift+R**.

**No se alimenta en absoluto.**
Comprueba en orden: el interruptor está **Activo**; hay un **objeto interruptor** seleccionado; el
**horario** es válido (`status.nextFeeding` muestra una hora); no está **bloqueado** (revisa `status.blocked` /
`status.blockReason`); la **ventana astronómica** no excluye la hora; pon el **nivel de registro** de la
instancia en `debug` y observa el registro.

**Nunca se alimenta de noche, aunque yo quiero.**
Desactiva *Restringir la alimentación a la ventana astronómica del día* para ese interruptor, o
ajusta sus desfases de orto/ocaso. Si la ventana astronómica está activada pero el interruptor no
tiene coordenadas válidas, su guardián de ventana permanece inactivo y se registra una advertencia.

**La supervisión notifica siempre una avería.**
Tu objeto interruptor probablemente no informe de su estado real (`ack=true`). O bien usa un
interruptor con retroalimentación de estado, o bien desactiva la *supervisión de la conmutación*
para ese interruptor.

**La alimentación dinámica no cambia nada.**
Asegúrate de que la fuente de temperatura seleccionada (agua o aire) esté activada en la pestaña del
interruptor (*Fuentes de temperatura y oxígeno*) y proporcione valores. Justo después de un reinicio,
la media móvil aún se está llenando, por lo que empieza desde los valores base. Observa
`status.dynamicAvgTemperature` y `status.dynamicIntervalMin`.

**La alimentación dinámica está activada pero nunca se alimenta (`status.nextFeeding` está vacío).**
El **intervalo base o el intervalo máximo es 0** (o la ventana de tiempo no es válida), por lo que no se puede calcular ningún intervalo: entonces `status.blockReason` muestra una indicación. Establece un intervalo base y un intervalo máximo mayores que 0 (y una ventana válida). Nota: dejar *tanto* el intervalo mínimo como el máximo en 0 también fuerza el resultado a 0.

**No se alimenta aunque no sea invierno (o se alimenta aunque debería pausar).**
Comprueba las fechas de la *Pausa de invierno* (`Inicio del invierno` / `Fin del invierno`, formato
dd.mm) y el modo. El punto de datos `status.winterActive` indica si la pausa está activa actualmente.

**La búsqueda de direcciones dice que la instancia debe estar en ejecución.**
Inicia la instancia de automatic-feeder: la geocodificación se ejecuta en el backend.

**Los mensajes de Telegram no llegan.**
¿Hay una instancia de Telegram seleccionada en la pestaña del interruptor? ¿Está el adaptador de
telegram configurado e iniciado? ¿Hay al menos un tipo de mensaje marcado y la *supervisión de la
conmutación* activada?

---

## 10. Registro y diagnóstico

El adaptador registra en los niveles habituales de ioBroker. Para mensajes detallados, sube el nivel
de registro de la instancia (Instancias → automatic-feeder.x → nivel de registro) a **debug** o
**silly**:

* **error**: errores que requieren atención (p. ej. fallo al escribir en el interruptor).
* **warn**: configuración incorrecta (sin coordenadas, horario no válido …).
* **info**: hitos (inicio, una alimentación ejecutada o bloqueada, activador manual).
* **debug**: desarrollo detallado (decisiones de planificación, actualizaciones de temperatura,
  geocodificación, valores de encendido/apagado, verificación confirmada/tiempo de espera agotado).
* **silly**: rastreo muy detallado (cada temporizador, cada comprobación de bloqueo, cada cambio de
  estado).

---

## 11. Alimentación dinámica — fundamentos y fuentes

Los peces (koi, carpas doradas, carpas de estanque) son **poiquilotermos (ectotermos)**: su
metabolismo sigue la temperatura del agua. Como regla general, la tasa metabólica casi se **duplica
por cada +10 °C**, que es justamente el **coeficiente Q10** (normalmente 2–3) que usa este adaptador,
de modo que alimentar más a menudo y un poco más cuando hace calor, y menos cuando hace frío, está
justificado fisiológicamente.

**Guía práctica de temperatura (koi/peces de estanque):**

* **por debajo de ~4–5 °C** – no alimentar (usa la *Pausa de invierno*).
* **~4–10 °C** – apenas activos; alimentar rara vez o nada, con comida fácilmente digestible (germen
  de trigo).
* **~10–15 °C** – alimentación reducida; el sistema inmunitario todavía está débil (~12 °C).
* **~15–25 °C** – rango óptimo de crecimiento, alimentación completa.
* **por encima de ~28 °C** – el **oxígeno** disuelto se convierte en el factor limitante → aquí es
  útil el bloqueo por O₂.

**Dónde medir, y por qué un segundo sensor:** la temperatura que importa es la del agua que los
peces ocupan realmente (la **zona de alimentación**), *no* la de la superficie (que puede diferir
varios grados). En un estanque mezclado por una bomba en marcha, o en un estanque poco profundo, un
sensor bien colocado es suficiente. Solo en un **estanque profundo y sin mezcla** el agua se
estratifica: por encima de 4 °C el agua caliente queda arriba (más fría abajo); por debajo de 4 °C
se invierte, dejando un refugio de ~4 °C cerca del fondo. Ahí un **segundo sensor (profundo)** aporta
valor: por seguridad (alimentar según la capa más fría), para un cambio estacional
superficial/profundo y para hacer visible la estratificación (`status.waterStratification`). Para la
mayoría de los estanques es opcional.

**Fuentes / lecturas adicionales:**

* Volkoff H. & Rønnestad I. (2020): *Effects of temperature on feeding and digestive processes in fish.* Temperature 7(4):307–320. <https://pubmed.ncbi.nlm.nih.gov/33251280/>
* K.O.I. – *Water Temperature and Koi.* <https://koiorganisationinternational.org/koi-articles/water-temperature-and-koi>
* K.O.I. – *The Science behind Cold Water in Koi Ponds.* <https://koiorganisationinternational.org/koi-articles/science-behind-cold-water-koi-ponds>
* Pond Informer – *Koi feeding guide.* <https://pondinformer.com/koi-feeding-guide/>

> Estas cifras son una orientación general para koi/peces de estanque, no un sustituto de observar a
> tus propios animales. Ajusta la temperatura de referencia, el Q10, los límites y los umbrales a tu
> especie y a tu instalación.

---

📖 [Documentación principal (inglés)](../../README.md)
