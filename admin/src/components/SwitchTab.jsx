import React from 'react';
import PropTypes from 'prop-types';
import {
	Box,
	Paper,
	Typography,
	RadioGroup,
	FormControlLabel,
	Radio,
	TextField,
	Checkbox,
	Button,
	IconButton,
	Tooltip,
	Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
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

/** Converts a text input value to a number or null (empty => null). */
function toNumberOrNull(value) {
	if (value === '' || value === null || value === undefined) {
		return null;
	}
	const n = Number(value);
	return Number.isNaN(n) ? null : n;
}

function SwitchTab(props) {
	const { sw, onChange, native } = props;

	const mode = sw.mode || 'times';
	const times = Array.isArray(sw.times) ? sw.times : [];

	const updateTime = (index, value) => {
		const next = times.slice();
		next[index] = value;
		onChange({ times: next });
	};
	const addTime = () => onChange({ times: [...times, '12:00'] });
	const removeTime = (index) => onChange({ times: times.filter((_, i) => i !== index) });

	return (
		<Box>
			{/* Mode */}
			<Section title={I18n.t('Feeding schedule')}>
				<RadioGroup row value={mode} onChange={(e) => onChange({ mode: e.target.value })}>
					<FormControlLabel value="times" control={<Radio />} label={I18n.t('Fixed times')} />
					<FormControlLabel
						value="interval"
						control={<Radio />}
						label={I18n.t('Interval within a time window')}
					/>
				</RadioGroup>

				{mode === 'times' ? (
					<Box sx={{ mt: 1 }}>
						{times.length === 0 ? (
							<Typography variant="body2" color="textSecondary">
								{I18n.t('No times defined yet.')}
							</Typography>
						) : null}
						{times.map((t, index) => (
							<Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
								<TextField
									variant="standard"
									type="time"
									label={`${I18n.t('Time')} ${index + 1}`}
									value={t || ''}
									onChange={(e) => updateTime(index, e.target.value)}
								/>
								<Tooltip title={I18n.t('Remove')}>
									<IconButton size="small" color="error" onClick={() => removeTime(index)}>
										<DeleteIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</Box>
						))}
						<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addTime}>
							{I18n.t('Add time')}
						</Button>
					</Box>
				) : (
					<Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
						<TextField
							variant="standard"
							type="time"
							label={I18n.t('Window start')}
							value={sw.windowStart || ''}
							onChange={(e) => onChange({ windowStart: e.target.value })}
						/>
						<TextField
							variant="standard"
							type="time"
							label={I18n.t('Window end')}
							value={sw.windowEnd || ''}
							onChange={(e) => onChange({ windowEnd: e.target.value })}
						/>
						<TextField
							variant="standard"
							type="number"
							label={I18n.t('Interval (minutes)')}
							value={sw.intervalMin ?? 60}
							onChange={(e) => onChange({ intervalMin: Number(e.target.value) || 0 })}
						/>
					</Box>
				)}
			</Section>

			{/* Duration & values */}
			<Section title={I18n.t('Feeding action')}>
				<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
					<TextField
						variant="standard"
						type="number"
						label={I18n.t('Feeding duration (seconds)')}
						value={sw.durationSec ?? 5}
						onChange={(e) => onChange({ durationSec: Number(e.target.value) || 0 })}
					/>
					<TextField
						variant="standard"
						label={I18n.t('On value (default true)')}
						value={sw.onValue === undefined ? 'true' : String(sw.onValue)}
						onChange={(e) => onChange({ onValue: e.target.value })}
					/>
					<TextField
						variant="standard"
						label={I18n.t('Off value (default false)')}
						value={sw.offValue === undefined ? 'false' : String(sw.offValue)}
						onChange={(e) => onChange({ offValue: e.target.value })}
					/>
				</Box>
			</Section>

			{/* Temperature blocking */}
			<Section title={I18n.t('Temperature blocking')}>
				{!native.airTempEnabled && !native.waterTempEnabled ? (
					<Typography variant="body2" color="textSecondary">
						{I18n.t('Enable a temperature source in the general settings to use this.')}
					</Typography>
				) : null}

				{native.waterTempEnabled ? (
					<Box sx={{ mb: 1 }}>
						<FormControlLabel
							control={
								<Checkbox
									checked={!!sw.blockWaterEnabled}
									onChange={(e) => onChange({ blockWaterEnabled: e.target.checked })}
								/>
							}
							label={I18n.t('Block by water temperature')}
						/>
						<Box sx={{ display: 'flex', gap: 2 }}>
							<TextField
								variant="standard"
								type="number"
								label={I18n.t('Block if below (°C)')}
								disabled={!sw.blockWaterEnabled}
								value={sw.waterMin ?? ''}
								onChange={(e) => onChange({ waterMin: toNumberOrNull(e.target.value) })}
							/>
							<TextField
								variant="standard"
								type="number"
								label={I18n.t('Block if above (°C)')}
								disabled={!sw.blockWaterEnabled}
								value={sw.waterMax ?? ''}
								onChange={(e) => onChange({ waterMax: toNumberOrNull(e.target.value) })}
							/>
						</Box>
					</Box>
				) : null}

				{native.airTempEnabled ? (
					<Box>
						{native.waterTempEnabled ? <Divider sx={{ my: 1 }} /> : null}
						<FormControlLabel
							control={
								<Checkbox
									checked={!!sw.blockAirEnabled}
									onChange={(e) => onChange({ blockAirEnabled: e.target.checked })}
								/>
							}
							label={I18n.t('Block by air temperature')}
						/>
						<Box sx={{ display: 'flex', gap: 2 }}>
							<TextField
								variant="standard"
								type="number"
								label={I18n.t('Block if below (°C)')}
								disabled={!sw.blockAirEnabled}
								value={sw.airMin ?? ''}
								onChange={(e) => onChange({ airMin: toNumberOrNull(e.target.value) })}
							/>
							<TextField
								variant="standard"
								type="number"
								label={I18n.t('Block if above (°C)')}
								disabled={!sw.blockAirEnabled}
								value={sw.airMax ?? ''}
								onChange={(e) => onChange({ airMax: toNumberOrNull(e.target.value) })}
							/>
						</Box>
					</Box>
				) : null}
			</Section>

			{/* Night & manual */}
			<Section title={I18n.t('Restrictions')}>
				<FormControlLabel
					control={
						<Checkbox
							checked={sw.respectNight !== false}
							onChange={(e) => onChange({ respectNight: e.target.checked })}
						/>
					}
					label={I18n.t('Do not feed at night (between sunset and sunrise, incl. offsets)')}
				/>
				<br />
				<FormControlLabel
					control={
						<Checkbox
							checked={!!sw.manualIgnoresBlocks}
							onChange={(e) => onChange({ manualIgnoresBlocks: e.target.checked })}
						/>
					}
					label={I18n.t('Manual trigger ignores all blocks')}
				/>
			</Section>
		</Box>
	);
}

SwitchTab.propTypes = {
	sw: PropTypes.object.isRequired,
	onChange: PropTypes.func.isRequired,
	native: PropTypes.object.isRequired,
};

export default SwitchTab;
