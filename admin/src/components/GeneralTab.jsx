import React, { useEffect, useRef, useState } from 'react';
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
	Switch,
	Button,
	IconButton,
	Tooltip,
	Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { I18n } from '@iobroker/adapter-react-v5';

import ObjectSelect from './ObjectSelect';
import LocationPicker from './LocationPicker';

const MAX_SWITCHES = 5;

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

function GeneralTab(props) {
	const { native, onChange, updateSwitch, addSwitch, removeSwitch, socket, theme, themeName, themeType, instanceId } =
		props;

	const [sysCoords, setSysCoords] = useState(null);

	useEffect(() => {
		let active = true;
		socket
			.getObject('system.config')
			.then((obj) => {
				if (active && obj && obj.common) {
					setSysCoords({ lat: obj.common.latitude, lon: obj.common.longitude });
				}
			})
			.catch(() => {
				/* ignore */
			});
		return () => {
			active = false;
		};
	}, [socket]);

	const switches = Array.isArray(native.switches) ? native.switches : [];

	// when a switch is added we stay on this tab (no tab jump); scroll the new
	// row into view so it is obvious that a switch was added and can be picked
	const lastSwitchRef = useRef(null);
	const prevSwitchCount = useRef(switches.length);
	useEffect(() => {
		if (switches.length > prevSwitchCount.current && lastSwitchRef.current) {
			lastSwitchRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
		prevSwitchCount.current = switches.length;
	}, [switches.length]);

	return (
		<Box>
			{/* Location */}
			<Section title={I18n.t('Location (for the astronomical window)')}>
				<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
					{I18n.t(
						'The location is used to compute sunrise/sunset for the per-switch astronomical feeding window. The sunrise/sunset offsets are configured per switch.',
					)}
				</Typography>
				<RadioGroup
					value={native.locationMode || 'system'}
					onChange={(e) => onChange('locationMode', e.target.value)}
				>
					<FormControlLabel
						value="system"
						control={<Radio />}
						label={I18n.t('Use system settings (system.config) for all switches')}
					/>
					<FormControlLabel
						value="shared"
						control={<Radio />}
						label={I18n.t('One shared location for all switches')}
					/>
					<FormControlLabel
						value="individual"
						control={<Radio />}
						label={I18n.t('Configure the location individually per switch')}
					/>
				</RadioGroup>

				{native.locationMode === 'shared' ? (
					<Box sx={{ mt: 1 }}>
						<LocationPicker
							latitude={native.latitude}
							longitude={native.longitude}
							address={native.address}
							socket={socket}
							instanceId={instanceId}
							onChange={(patch) => {
								if (patch.latitude !== undefined) {
									onChange('latitude', patch.latitude);
								}
								if (patch.longitude !== undefined) {
									onChange('longitude', patch.longitude);
								}
								if (patch.address !== undefined) {
									onChange('address', patch.address);
								}
							}}
						/>
					</Box>
				) : native.locationMode === 'individual' ? (
					<Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
						{I18n.t('Each switch defines its own location on its tab.')}
					</Typography>
				) : (
					<Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
						{sysCoords && sysCoords.lat !== undefined && sysCoords.lat !== ''
							? `${I18n.t('Latitude')}: ${sysCoords.lat}, ${I18n.t('Longitude')}: ${sysCoords.lon}`
							: I18n.t('No coordinates configured in the ioBroker system settings!')}
					</Typography>
				)}
			</Section>

			{/* Switches roster */}
			<Section title={`${I18n.t('Switches')} (${switches.length}/${MAX_SWITCHES})`}>
				<Box sx={{ mb: 1 }}>
					<FormControlLabel
						control={
							<Switch
								checked={!!native.relayEnabled}
								onChange={(e) => onChange('relayEnabled', e.target.checked)}
							/>
						}
						label={I18n.t('Use the Automatic-Feeder relay board (adds a relay tab per switch)')}
					/>
					<Typography variant="body2" color="textSecondary">
						{I18n.t(
							'Enable this if you use the Automatic-Feeder relay board (ESP32). Each switch then gets an additional tab to set the board address and its S1-S3 button feeding times.',
						)}
					</Typography>
				</Box>
				<Divider sx={{ mb: 1 }} />
				{switches.length === 0 ? (
					<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
						{I18n.t('No switches configured yet. Add one to create its own tab.')}
					</Typography>
				) : null}
				{switches.map((sw, index) => (
					<Box key={sw.id || index} ref={index === switches.length - 1 ? lastSwitchRef : undefined}>
						{index > 0 ? <Divider sx={{ my: 1 }} /> : null}
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<Tooltip title={I18n.t('Active')}>
								<Checkbox
									checked={!!sw.enabled}
									onChange={(e) => updateSwitch(index, { enabled: e.target.checked })}
								/>
							</Tooltip>
							<TextField
								variant="standard"
								label={I18n.t('Name')}
								value={sw.name || ''}
								sx={{ minWidth: 180 }}
								onChange={(e) => updateSwitch(index, { name: e.target.value })}
							/>
							<Box sx={{ flexGrow: 1 }}>
								<ObjectSelect
									label={I18n.t('Switch object')}
									value={sw.objectId}
									onChange={(v) => updateSwitch(index, { objectId: v })}
									socket={socket}
									theme={theme}
									themeName={themeName}
									themeType={themeType}
								/>
							</Box>
							<Tooltip title={I18n.t('Remove switch')}>
								<IconButton color="error" onClick={() => removeSwitch(index)}>
									<DeleteIcon />
								</IconButton>
							</Tooltip>
						</Box>
					</Box>
				))}
				<Button
					variant="outlined"
					startIcon={<AddIcon />}
					sx={{ mt: 2 }}
					disabled={switches.length >= MAX_SWITCHES}
					onClick={addSwitch}
				>
					{I18n.t('Add switch')}
				</Button>
			</Section>
		</Box>
	);
}

GeneralTab.propTypes = {
	native: PropTypes.object.isRequired,
	onChange: PropTypes.func.isRequired,
	updateSwitch: PropTypes.func.isRequired,
	addSwitch: PropTypes.func.isRequired,
	removeSwitch: PropTypes.func.isRequired,
	socket: PropTypes.object.isRequired,
	theme: PropTypes.object.isRequired,
	themeName: PropTypes.string,
	themeType: PropTypes.string,
	instanceId: PropTypes.string.isRequired,
};

export default GeneralTab;
