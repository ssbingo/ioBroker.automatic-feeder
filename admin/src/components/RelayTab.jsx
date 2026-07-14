import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Alert, Chip, Divider } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import SaveIcon from '@mui/icons-material/Save';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { I18n } from '@iobroker/adapter-react-v5';

function Section({ title, children }) {
	return (
		<Paper elevation={1} sx={{ p: 2, mb: 2 }}>
			<Typography variant="h6" sx={{ mb: 1 }}>
				{title}
			</Typography>
			{children}
		</Paper>
	);
}

Section.propTypes = {
	title: PropTypes.string,
	children: PropTypes.node,
};

/** Clamps a button feeding time to the range the board accepts (1..600 s). */
function clampSeconds(value) {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) {
		return 5;
	}
	return Math.min(600, Math.max(1, n));
}

function RelayTab(props) {
	const { sw, onChange, socket, instanceId } = props;

	const host = sw.relayHost || '';

	const [busy, setBusy] = useState(false); // "test" | "save" | false
	const [status, setStatus] = useState(null); // { connected, host, ip, fw, wifi } | null
	const [msg, setMsg] = useState(null); // { severity, text }

	// pull the current S1-S3 times from the board and copy them into the config
	const testAndFetch = async () => {
		if (!host.trim()) {
			setMsg({ severity: 'warning', text: I18n.t('Enter the board address first.') });
			return;
		}
		setBusy('test');
		setMsg(null);
		try {
			const res = await socket.sendTo(instanceId, 'relayGet', { host });
			if (!res || res.error) {
				setStatus({ connected: false });
				setMsg({ severity: 'error', text: (res && res.error) || I18n.t('Connection failed') });
			} else {
				setStatus({ connected: !!res.connected, host: res.host, ip: res.ip, fw: res.fw, wifi: res.wifi });
				if (Array.isArray(res.times) && res.times.length >= 3) {
					onChange({
						relayS1: clampSeconds(res.times[0]),
						relayS2: clampSeconds(res.times[1]),
						relayS3: clampSeconds(res.times[2]),
					});
				}
				setMsg({ severity: 'success', text: I18n.t('Connected — button times fetched from the board.') });
			}
		} catch (e) {
			setStatus({ connected: false });
			setMsg({ severity: 'error', text: `${I18n.t('Connection failed')}: ${e}` });
		}
		setBusy(false);
	};

	// write the configured S1-S3 times to the board
	const saveToBoard = async () => {
		if (!host.trim()) {
			setMsg({ severity: 'warning', text: I18n.t('Enter the board address first.') });
			return;
		}
		setBusy('save');
		setMsg(null);
		const time1 = clampSeconds(sw.relayS1);
		const time2 = clampSeconds(sw.relayS2);
		const time3 = clampSeconds(sw.relayS3);
		// normalise the stored values to the clamped ones
		onChange({ relayS1: time1, relayS2: time2, relayS3: time3 });
		try {
			const res = await socket.sendTo(instanceId, 'relaySet', { host, time1, time2, time3 });
			if (!res || res.error) {
				setMsg({ severity: 'error', text: (res && res.error) || I18n.t('Saving to the board failed') });
			} else {
				setStatus({ connected: !!res.connected, host: res.host, ip: res.ip, fw: res.fw, wifi: res.wifi });
				if (Array.isArray(res.times) && res.times.length >= 3) {
					onChange({
						relayS1: clampSeconds(res.times[0]),
						relayS2: clampSeconds(res.times[1]),
						relayS3: clampSeconds(res.times[2]),
					});
				}
				setMsg({ severity: 'success', text: I18n.t('Saved to the board.') });
			}
		} catch (e) {
			setMsg({ severity: 'error', text: `${I18n.t('Saving to the board failed')}: ${e}` });
		}
		setBusy(false);
	};

	const timeField = (key, label) => (
		<TextField
			variant="standard"
			type="number"
			label={label}
			value={sw[key] ?? 5}
			inputProps={{ min: 1, max: 600 }}
			sx={{ width: 140 }}
			onChange={(e) => onChange({ [key]: e.target.value === '' ? '' : Number(e.target.value) })}
		/>
	);

	return (
		<Box>
			<Section title={I18n.t('Relay board')}>
				<Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
					{I18n.t(
						'The Automatic-Feeder relay board (ESP32) is reached over your network on port 80. Enter its IP address or mDNS host and test the connection.',
					)}
				</Typography>
				<Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
					<TextField
						variant="standard"
						label={I18n.t('Board address (IP or mDNS host)')}
						placeholder="192.168.1.50"
						value={host}
						sx={{ minWidth: 260 }}
						onChange={(e) => onChange({ relayHost: e.target.value })}
					/>
					<Button
						variant="outlined"
						startIcon={busy === 'test' ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
						disabled={!!busy || !host.trim()}
						onClick={testAndFetch}
					>
						{I18n.t('Test connection & fetch times')}
					</Button>
					{status ? (
						<Chip
							icon={status.connected ? <WifiIcon /> : <WifiOffIcon />}
							color={status.connected ? 'success' : 'error'}
							label={status.connected ? I18n.t('Connected') : I18n.t('Not connected')}
							variant="outlined"
						/>
					) : null}
				</Box>
				{status && status.connected ? (
					<Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
						{[
							status.host ? `${I18n.t('Board')}: ${status.host}` : null,
							status.ip ? `IP: ${status.ip}` : null,
							status.fw ? `${I18n.t('Firmware')}: ${status.fw}` : null,
						]
							.filter(Boolean)
							.join('  ·  ')}
					</Typography>
				) : null}
				{msg ? (
					<Alert severity={msg.severity} sx={{ mt: 1 }} onClose={() => setMsg(null)}>
						{msg.text}
					</Alert>
				) : null}
			</Section>

			<Section title={I18n.t('Button feeding times (seconds)')}>
				<Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
					{I18n.t(
						'These times are also editable on the board’s own web interface. Fetch them first (button above), then adjust and save them back to the board.',
					)}
				</Typography>
				<Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
					{timeField('relayS1', I18n.t('Button 1 (S1)'))}
					{timeField('relayS2', I18n.t('Button 2 (S2)'))}
					{timeField('relayS3', I18n.t('Button 3 (S3)'))}
				</Box>
				<Divider sx={{ my: 2 }} />
				<Button
					variant="contained"
					color="primary"
					startIcon={busy === 'save' ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
					disabled={!!busy || !host.trim()}
					onClick={saveToBoard}
				>
					{I18n.t('Save times to board')}
				</Button>
			</Section>
		</Box>
	);
}

RelayTab.propTypes = {
	sw: PropTypes.object.isRequired,
	onChange: PropTypes.func.isRequired,
	socket: PropTypes.object.isRequired,
	instanceId: PropTypes.string.isRequired,
};

export default RelayTab;
