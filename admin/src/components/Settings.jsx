import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, Tabs, Tab } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';

import GeneralTab from './GeneralTab';
import SwitchTab from './SwitchTab';
import RelayTab from './RelayTab';

const MAX_SWITCHES = 5;

/** Creates a stable, collision-free internal id for a new switch. */
function nextSwitchId(switches) {
	const usedNums = switches
		.map((s) => parseInt(String(s.id || '').replace('sw-', ''), 10))
		.filter((n) => !Number.isNaN(n));
	const next = usedNums.length ? Math.max(...usedNums) + 1 : 0;
	return `sw-${next}`;
}

function createSwitch(switches) {
	return {
		id: nextSwitchId(switches),
		name: '',
		enabled: true,
		objectId: '',
		onValue: true,
		offValue: false,
		durationSec: 5,
		mode: 'times',
		times: ['08:00'],
		windowStart: '08:00',
		windowEnd: '18:00',
		intervalMin: 60,
		blockWaterEnabled: false,
		waterMin: null,
		waterMax: null,
		blockAirEnabled: false,
		airMin: null,
		airMax: null,
		astroWindowEnabled: false,
		sunOffsetMorning: 0,
		sunOffsetEvening: 0,
		coordinateSource: 'system',
		latitude: '',
		longitude: '',
		address: '',
		manualIgnoresBlocks: false,
		verifyEnabled: true,
		verifyTimeoutSec: 5,
		verifyRetries: 3,
		telegramInstance: '',
		telegramUser: '',
		notifySuccess: false,
		notifyOnFail: true,
		notifyOffFail: true,
		manualDurationSec: 5,
		winterEnabled: false,
		winterStart: '11-01',
		winterEnd: '03-15',
		winterMode: 'suspend',
		winterIntervalMin: 240,
		winterTime: '12:00',
		winterDurationSec: 5,
		winterStartReminderEnabled: false,
		winterStartReminderDays: 7,
		winterEndReminderEnabled: false,
		winterEndReminderDays: 7,
		winterReminderHour: 9,
		pauseNow: false,
		pause1Enabled: false,
		pause1Start: '',
		pause1End: '',
		pause2Enabled: false,
		pause2Start: '',
		pause2End: '',
		pause3Enabled: false,
		pause3Start: '',
		pause3End: '',
		dynamicEnabled: false,
		dynamicSource: 'water',
		dynamicTRef: 20,
		dynamicQ10: 2.2,
		dynamicBaseIntervalMin: 60,
		dynamicMinIntervalMin: 30,
		dynamicMaxIntervalMin: 480,
		dynamicBaseDurationSec: 5,
		dynamicMinDurationSec: 2,
		dynamicMaxDurationSec: 15,
		dynamicBufferHours: 24,
		dynamicHysteresisPct: 15,
		blockO2Enabled: false,
		o2Min: null,
		airTempEnabled: false,
		airTempObjectId: '',
		waterTempEnabled: false,
		waterTempObjectId: '',
		waterTemp2Enabled: false,
		waterTemp2ObjectId: '',
		waterCombineMode: 'shallow',
		waterSeasonalThresholdC: 12,
		o2Enabled: false,
		o2ObjectId: '',
		relayHost: '',
		relayS1: 5,
		relayS2: 5,
		relayS3: 5,
	};
}

function Settings(props) {
	const { native, onChange, socket, theme, themeName, themeType, instanceId } = props;
	const [tab, setTab] = useState(0);
	const [telegramInstances, setTelegramInstances] = useState([]);

	// read the installed telegram instances once, so switches can pick one from a list
	useEffect(() => {
		let active = true;
		socket
			.getAdapterInstances('telegram')
			.then((list) => {
				if (active) {
					setTelegramInstances((list || []).map((o) => o._id.replace('system.adapter.', '')));
				}
			})
			.catch(() => {
				/* telegram not installed -> empty list */
			});
		return () => {
			active = false;
		};
	}, [socket]);

	const switches = Array.isArray(native.switches) ? native.switches : [];

	const updateSwitch = (index, patch) => {
		const next = switches.map((s, i) => (i === index ? { ...s, ...patch } : s));
		onChange('switches', next);
	};

	const addSwitch = () => {
		if (switches.length >= MAX_SWITCHES) {
			return;
		}
		const next = [...switches, createSwitch(switches)];
		onChange('switches', next);
		// stay on the general tab so the switch object is selected first; the new
		// switch's own tab is created but intentionally not focused
	};

	const removeSwitch = (index) => {
		const next = switches.filter((_, i) => i !== index);
		onChange('switches', next);
		// go back to the general tab; the interleaved tab list changes length and the
		// render below clamps the active tab into the new range anyway
		setTab(0);
	};

	// Tab layout: [general] then, per switch, its config tab and (when the relay board
	// integration is enabled) an additional relay tab right after it, so a switch and
	// its board stay next to each other.
	const relayEnabled = !!native.relayEnabled;
	const tabDefs = [{ type: 'general' }];
	switches.forEach((sw, index) => {
		tabDefs.push({ type: 'switch', index });
		if (relayEnabled) {
			tabDefs.push({ type: 'relay', index });
		}
	});
	const current = Math.min(tab, tabDefs.length - 1);
	const currentDef = tabDefs[current];

	const switchLabel = (sw, index) =>
		sw.name && sw.name.trim() ? sw.name : `${I18n.t('Switch')} ${index + 1}`;

	return (
		<Box sx={{ p: 2, pb: 10 }}>
			<Tabs
				value={current}
				onChange={(_e, v) => setTab(v)}
				variant="scrollable"
				scrollButtons="auto"
				sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
			>
				{tabDefs.map((def, i) => {
					if (def.type === 'general') {
						return <Tab key="general" label={I18n.t('General settings')} />;
					}
					const sw = switches[def.index];
					const key = `${sw.id || def.index}-${def.type}`;
					const label =
						def.type === 'relay'
							? `${switchLabel(sw, def.index)} · ${I18n.t('Relay')}`
							: switchLabel(sw, def.index);
					return <Tab key={key} label={label} />;
				})}
			</Tabs>

			{currentDef && currentDef.type === 'general' ? (
				<GeneralTab
					native={native}
					onChange={onChange}
					updateSwitch={updateSwitch}
					addSwitch={addSwitch}
					removeSwitch={removeSwitch}
					socket={socket}
					theme={theme}
					themeName={themeName}
					themeType={themeType}
					instanceId={instanceId}
				/>
			) : null}

			{currentDef && currentDef.type === 'switch' ? (
				<SwitchTab
					sw={switches[currentDef.index]}
					native={native}
					onChange={(patch) => updateSwitch(currentDef.index, patch)}
					socket={socket}
					instanceId={instanceId}
					telegramInstances={telegramInstances}
					theme={theme}
					themeName={themeName}
					themeType={themeType}
				/>
			) : null}

			{currentDef && currentDef.type === 'relay' ? (
				<RelayTab
					sw={switches[currentDef.index]}
					onChange={(patch) => updateSwitch(currentDef.index, patch)}
					socket={socket}
					instanceId={instanceId}
				/>
			) : null}
		</Box>
	);
}

Settings.propTypes = {
	native: PropTypes.object.isRequired,
	onChange: PropTypes.func.isRequired,
	socket: PropTypes.object.isRequired,
	theme: PropTypes.object.isRequired,
	themeName: PropTypes.string,
	themeType: PropTypes.string,
	instanceId: PropTypes.string.isRequired,
};

export default Settings;
