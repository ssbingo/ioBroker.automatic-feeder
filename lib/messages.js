'use strict';

/**
 * Backend notification / status texts in every language ioBroker supports.
 *
 * These strings are user facing: they are stored in the per-switch `lastResult`
 * datapoint and sent to Telegram. The configured system language
 * (system.config.common.language) selects the variant; English is the fallback
 * when the language is unset or unsupported.
 *
 * Use `{placeholder}` tokens and pass the values to {@link translate}.
 */
const MESSAGES = {
	feedSuccess: {
		en: 'Feeding triggered for {seconds}s.',
		de: 'Fütterung für {seconds}s ausgelöst.',
		ru: 'Кормление запущено на {seconds} с.',
		pt: 'Alimentação acionada por {seconds}s.',
		nl: 'Voeding geactiveerd voor {seconds}s.',
		fr: 'Distribution déclenchée pour {seconds}s.',
		it: 'Alimentazione attivata per {seconds}s.',
		es: 'Alimentación activada durante {seconds}s.',
		pl: 'Karmienie uruchomione na {seconds}s.',
		uk: 'Годування запущено на {seconds} с.',
		'zh-cn': '已触发投喂 {seconds} 秒。',
	},
	feedOnFail: {
		en: 'Feeding could not be performed. Check the switch!',
		de: 'Fütterung konnte nicht durchgeführt werden. Schalter prüfen!',
		ru: 'Не удалось выполнить кормление. Проверьте переключатель!',
		pt: 'Não foi possível alimentar. Verifique o interruptor!',
		nl: 'Voeding kon niet worden uitgevoerd. Controleer de schakelaar!',
		fr: "La distribution n'a pas pu être effectuée. Vérifiez l'interrupteur !",
		it: "Impossibile eseguire l'alimentazione. Controllare l'interruttore!",
		es: 'No se pudo realizar la alimentación. ¡Compruebe el interruptor!',
		pl: 'Nie udało się przeprowadzić karmienia. Sprawdź przełącznik!',
		uk: 'Не вдалося виконати годування. Перевірте перемикач!',
		'zh-cn': '无法执行投喂。请检查开关！',
	},
	feedOffFail: {
		en: 'Fault: the feeder did not switch off!',
		de: 'Störung: Futterautomat hat nicht abgeschaltet!',
		ru: 'Неисправность: кормушка не выключилась!',
		pt: 'Falha: o alimentador não desligou!',
		nl: 'Storing: de voederautomaat is niet uitgeschakeld!',
		fr: "Défaut : le distributeur ne s'est pas éteint !",
		it: "Guasto: l'alimentatore non si è spento!",
		es: 'Avería: ¡el comedero no se apagó!',
		pl: 'Awaria: automat do karmienia nie wyłączył się!',
		uk: 'Несправність: годівниця не вимкнулася!',
		'zh-cn': '故障：喂食器未关闭！',
	},
	blockNight: {
		en: 'outside sun window (night)',
		de: 'außerhalb des Sonnenfensters (Nacht)',
		ru: 'вне светового окна (ночь)',
		pt: 'fora da janela solar (noite)',
		nl: 'buiten het zonvenster (nacht)',
		fr: 'en dehors de la fenêtre solaire (nuit)',
		it: 'fuori dalla finestra solare (notte)',
		es: 'fuera de la ventana solar (noche)',
		pl: 'poza oknem słonecznym (noc)',
		uk: 'поза сонячним вікном (ніч)',
		'zh-cn': '不在日照时段内（夜间）',
	},
	blockWaterBelow: {
		en: 'water temperature {temp}°C below {limit}°C',
		de: 'Wassertemperatur {temp}°C unter {limit}°C',
		ru: 'температура воды {temp}°C ниже {limit}°C',
		pt: 'temperatura da água {temp}°C abaixo de {limit}°C',
		nl: 'watertemperatuur {temp}°C onder {limit}°C',
		fr: "température de l'eau {temp}°C inférieure à {limit}°C",
		it: "temperatura dell'acqua {temp}°C inferiore a {limit}°C",
		es: 'temperatura del agua {temp}°C por debajo de {limit}°C',
		pl: 'temperatura wody {temp}°C poniżej {limit}°C',
		uk: 'температура води {temp}°C нижче {limit}°C',
		'zh-cn': '水温 {temp}°C 低于 {limit}°C',
	},
	blockWaterAbove: {
		en: 'water temperature {temp}°C above {limit}°C',
		de: 'Wassertemperatur {temp}°C über {limit}°C',
		ru: 'температура воды {temp}°C выше {limit}°C',
		pt: 'temperatura da água {temp}°C acima de {limit}°C',
		nl: 'watertemperatuur {temp}°C boven {limit}°C',
		fr: "température de l'eau {temp}°C supérieure à {limit}°C",
		it: "temperatura dell'acqua {temp}°C superiore a {limit}°C",
		es: 'temperatura del agua {temp}°C por encima de {limit}°C',
		pl: 'temperatura wody {temp}°C powyżej {limit}°C',
		uk: 'температура води {temp}°C вище {limit}°C',
		'zh-cn': '水温 {temp}°C 高于 {limit}°C',
	},
	blockAirBelow: {
		en: 'air temperature {temp}°C below {limit}°C',
		de: 'Lufttemperatur {temp}°C unter {limit}°C',
		ru: 'температура воздуха {temp}°C ниже {limit}°C',
		pt: 'temperatura do ar {temp}°C abaixo de {limit}°C',
		nl: 'luchttemperatuur {temp}°C onder {limit}°C',
		fr: "température de l'air {temp}°C inférieure à {limit}°C",
		it: "temperatura dell'aria {temp}°C inferiore a {limit}°C",
		es: 'temperatura del aire {temp}°C por debajo de {limit}°C',
		pl: 'temperatura powietrza {temp}°C poniżej {limit}°C',
		uk: 'температура повітря {temp}°C нижче {limit}°C',
		'zh-cn': '气温 {temp}°C 低于 {limit}°C',
	},
	blockAirAbove: {
		en: 'air temperature {temp}°C above {limit}°C',
		de: 'Lufttemperatur {temp}°C über {limit}°C',
		ru: 'температура воздуха {temp}°C выше {limit}°C',
		pt: 'temperatura do ar {temp}°C acima de {limit}°C',
		nl: 'luchttemperatuur {temp}°C boven {limit}°C',
		fr: "température de l'air {temp}°C supérieure à {limit}°C",
		it: "temperatura dell'aria {temp}°C superiore a {limit}°C",
		es: 'temperatura del aire {temp}°C por encima de {limit}°C',
		pl: 'temperatura powietrza {temp}°C powyżej {limit}°C',
		uk: 'температура повітря {temp}°C вище {limit}°C',
		'zh-cn': '气温 {temp}°C 高于 {limit}°C',
	},
	winterStartSuspend: {
		en: 'Winter pause is starting. Remember to remove and clean the feeder.',
		de: 'Winterpause beginnt. Vergiss nicht den Feeder zu demontieren und zu reinigen.',
		ru: 'Начинается зимняя пауза. Не забудьте снять и очистить кормушку.',
		pt: 'A pausa de inverno está começando. Lembre-se de remover e limpar o alimentador.',
		nl: 'De winterpauze begint. Vergeet niet de feeder te demonteren en te reinigen.',
		fr: "La pause hivernale commence. N'oubliez pas de démonter et de nettoyer le distributeur.",
		it: "La pausa invernale sta iniziando. Ricordati di smontare e pulire l'alimentatore.",
		es: 'Comienza la pausa de invierno. Recuerda desmontar y limpiar el comedero.',
		pl: 'Rozpoczyna się przerwa zimowa. Pamiętaj o demontażu i wyczyszczeniu karmnika.',
		uk: 'Починається зимова пауза. Не забудьте зняти та очистити годівницю.',
		'zh-cn': '冬季暂停即将开始。请记得拆卸并清洁喂食器。',
	},
	winterStartReduced: {
		en: 'Winter pause with reduced feeding starts on {date}. Please check the food supply again.',
		de: 'Winterpause mit eingeschränkter Fütterung beginnt am {date}. Prüfe nochmals den Futtervorrat.',
		ru: 'Зимняя пауза с ограниченным кормлением начинается {date}. Проверьте ещё раз запас корма.',
		pt: 'A pausa de inverno com alimentação reduzida começa em {date}. Verifique novamente o estoque de ração.',
		nl: 'De winterpauze met beperkte voeding begint op {date}. Controleer nogmaals de voervoorraad.',
		fr: 'La pause hivernale avec alimentation réduite commence le {date}. Vérifiez à nouveau la réserve de nourriture.',
		it: 'La pausa invernale con alimentazione ridotta inizia il {date}. Controlla di nuovo la scorta di mangime.',
		es: 'La pausa de invierno con alimentación reducida comienza el {date}. Comprueba de nuevo las reservas de comida.',
		pl: 'Przerwa zimowa z ograniczonym karmieniem rozpoczyna się {date}. Sprawdź ponownie zapas karmy.',
		uk: 'Зимова пауза з обмеженим годуванням починається {date}. Перевірте ще раз запас корму.',
		'zh-cn': '减量投喂的冬季暂停将于 {date} 开始。请再次检查饲料储备。',
	},
	winterEndSuspend: {
		en: 'Summer operation is starting. Please remount the feeder and refill the food.',
		de: 'Sommerbetrieb beginnt. Bitte montiere den Feeder wieder und fülle Futter auf.',
		ru: 'Начинается летний режим. Пожалуйста, снова установите кормушку и наполните её кормом.',
		pt: 'O modo de verão está começando. Por favor, monte novamente o alimentador e reabasteça a ração.',
		nl: 'De zomerwerking begint. Monteer de feeder weer en vul het voer bij.',
		fr: 'Le fonctionnement estival commence. Veuillez remonter le distributeur et refaire le plein de nourriture.',
		it: "Inizia il funzionamento estivo. Rimonta l'alimentatore e rifornisci il mangime.",
		es: 'Comienza el funcionamiento de verano. Vuelve a montar el comedero y rellena la comida.',
		pl: 'Rozpoczyna się tryb letni. Zamontuj ponownie karmnik i uzupełnij karmę.',
		uk: 'Починається літній режим. Будь ласка, знову встановіть годівницю та наповніть її кормом.',
		'zh-cn': '夏季运行即将开始。请重新安装喂食器并补充饲料。',
	},
	winterEndReduced: {
		en: 'Summer operation is starting. Check your feeder and refill with the appropriate food.',
		de: 'Sommerbetrieb beginnt. Prüfe deinen Feeder und fülle entsprechendes Futter auf.',
		ru: 'Начинается летний режим. Проверьте кормушку и наполните её подходящим кормом.',
		pt: 'O modo de verão está começando. Verifique o alimentador e reabasteça com a ração adequada.',
		nl: 'De zomerwerking begint. Controleer je feeder en vul bij met het juiste voer.',
		fr: 'Le fonctionnement estival commence. Vérifiez votre distributeur et refaites le plein avec la nourriture appropriée.',
		it: "Inizia il funzionamento estivo. Controlla l'alimentatore e rifornisci con il mangime adeguato.",
		es: 'Comienza el funcionamiento de verano. Comprueba tu comedero y rellénalo con la comida adecuada.',
		pl: 'Rozpoczyna się tryb letni. Sprawdź karmnik i uzupełnij odpowiednią karmę.',
		uk: 'Починається літній режим. Перевірте годівницю та наповніть її відповідним кормом.',
		'zh-cn': '夏季运行即将开始。请检查喂食器并补充相应的饲料。',
	},
	blockOxygenLow: {
		en: 'oxygen {value} below {limit}',
		de: 'Sauerstoff {value} unter {limit}',
		ru: 'кислород {value} ниже {limit}',
		pt: 'oxigênio {value} abaixo de {limit}',
		nl: 'zuurstof {value} onder {limit}',
		fr: 'oxygène {value} inférieur à {limit}',
		it: 'ossigeno {value} inferiore a {limit}',
		es: 'oxígeno {value} por debajo de {limit}',
		pl: 'tlen {value} poniżej {limit}',
		uk: 'кисень {value} нижче {limit}',
		'zh-cn': '溶氧 {value} 低于 {limit}',
	},
	dynamicNoInterval: {
		en: 'dynamic feeding: no valid interval (check base/max interval and time window)',
		de: 'dynamisches Füttern: kein gültiges Intervall (Basis-/Max-Intervall und Zeitfenster prüfen)',
		ru: 'динамическое кормление: нет допустимого интервала (проверьте базовый/макс. интервал и временное окно)',
		pt: 'alimentação dinâmica: sem intervalo válido (verifique o intervalo base/máx. e a janela de tempo)',
		nl: 'dynamisch voeren: geen geldig interval (controleer basis-/max.-interval en tijdvenster)',
		fr: "alimentation dynamique : aucun intervalle valide (vérifiez l'intervalle de base/max. et la fenêtre horaire)",
		it: 'alimentazione dinamica: nessun intervallo valido (controllare intervallo base/max e finestra oraria)',
		es: 'alimentación dinámica: sin intervalo válido (revise el intervalo base/máx. y la ventana horaria)',
		pl: 'karmienie dynamiczne: brak prawidłowego interwału (sprawdź interwał podstawowy/maks. i okno czasowe)',
		uk: 'динамічне годування: немає дійсного інтервалу (перевірте базовий/макс. інтервал і часове вікно)',
		'zh-cn': '动态投喂：无有效间隔（请检查基础/最大间隔和时间窗口）',
	},
};

/** All languages ioBroker offers for system.config.common.language. */
const SUPPORTED_LANGUAGES = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

/** Language used when the system language is unset or not supported. */
const DEFAULT_LANGUAGE = 'en';

/**
 * Translates a message key into the requested language and fills in any
 * `{placeholder}` tokens. Falls back to English (and finally to the raw key)
 * when a translation is missing.
 *
 * @param {string} key - message key from {@link MESSAGES}
 * @param {string} [lang] - target language code (e.g. "de")
 * @param {Record<string, string | number>} [params] - placeholder values
 * @returns {string} the localized, interpolated message
 */
function translate(key, lang, params) {
	const entry = MESSAGES[key];
	if (!entry) {
		return key;
	}
	let text = (lang && entry[lang]) || entry[DEFAULT_LANGUAGE] || key;
	if (params) {
		for (const name of Object.keys(params)) {
			text = text.split(`{${name}}`).join(String(params[name]));
		}
	}
	return text;
}

module.exports = { MESSAGES, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, translate };
