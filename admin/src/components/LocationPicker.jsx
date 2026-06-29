import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Box, Button, TextField, CircularProgress, Typography } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';

// Fix the default marker icon (the bundler rewrites the relative asset paths) by
// pointing Leaflet to the CDN copies. The map tiles already require internet access.
L.Icon.Default.mergeOptions({
	iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
	iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const GERMANY_CENTER = [51.1657, 10.4515];

/** Moves the map when the coordinates change from outside (e.g. address search). */
function Recenter({ lat, lng }) {
	const map = useMap();
	useEffect(() => {
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			map.setView([lat, lng], Math.max(map.getZoom(), 13));
		}
	}, [lat, lng, map]);
	return null;
}

Recenter.propTypes = {
	lat: PropTypes.number,
	lng: PropTypes.number,
};

/** Sets the marker where the user clicks on the map. */
function ClickHandler({ onPick }) {
	useMapEvents({
		click(e) {
			onPick(e.latlng.lat, e.latlng.lng);
		},
	});
	return null;
}

ClickHandler.propTypes = {
	onPick: PropTypes.func.isRequired,
};

/**
 * Address search (via the adapter backend / Nominatim) plus an OpenStreetMap map
 * with a draggable marker to define the feeding location.
 */
function LocationPicker(props) {
	const { latitude, longitude, address, onChange, socket, instanceId } = props;
	const [query, setQuery] = useState(address || '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const latNum = parseFloat(latitude);
	const lngNum = parseFloat(longitude);
	const hasPos = Number.isFinite(latNum) && Number.isFinite(lngNum);
	const center = hasPos ? [latNum, lngNum] : GERMANY_CENTER;

	const search = async () => {
		if (!query) {
			return;
		}
		setBusy(true);
		setError('');
		try {
			const res = await socket.sendTo(instanceId, 'geocode', { query });
			if (res && res.lat !== undefined && res.lat !== null) {
				onChange({
					latitude: String(res.lat),
					longitude: String(res.lon),
					address: res.displayName || query,
				});
			} else {
				setError((res && res.error) || I18n.t('No location found'));
			}
		} catch (e) {
			setError(I18n.t('Geocoding failed: instance must be running') + ` (${e})`);
		}
		setBusy(false);
	};

	return (
		<Box>
			<Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
				<TextField
					variant="standard"
					fullWidth
					label={I18n.t('Address search')}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							search();
						}
					}}
				/>
				<Button variant="contained" onClick={search} disabled={busy || !query} sx={{ mt: 1 }}>
					{busy ? <CircularProgress size={20} /> : I18n.t('Search')}
				</Button>
			</Box>
			{error ? (
				<Typography color="error" variant="body2" sx={{ mb: 1 }}>
					{error}
				</Typography>
			) : null}
			<Box sx={{ height: 320, mb: 1, border: '1px solid rgba(128,128,128,0.4)' }}>
				<MapContainer center={center} zoom={hasPos ? 13 : 5} style={{ height: '100%', width: '100%' }}>
					<TileLayer
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					<ClickHandler
						onPick={(la, ln) => onChange({ latitude: la.toFixed(6), longitude: ln.toFixed(6) })}
					/>
					{hasPos ? (
						<Marker
							position={[latNum, lngNum]}
							draggable
							eventHandlers={{
								dragend: (e) => {
									const p = e.target.getLatLng();
									onChange({ latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) });
								},
							}}
						/>
					) : null}
					<Recenter lat={latNum} lng={lngNum} />
				</MapContainer>
			</Box>
			<Typography variant="caption" color="textSecondary">
				{I18n.t('Click on the map or drag the marker to set the location.')}
			</Typography>
			<Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
				<TextField
					variant="standard"
					label={I18n.t('Latitude')}
					value={latitude || ''}
					onChange={(e) => onChange({ latitude: e.target.value })}
				/>
				<TextField
					variant="standard"
					label={I18n.t('Longitude')}
					value={longitude || ''}
					onChange={(e) => onChange({ longitude: e.target.value })}
				/>
			</Box>
		</Box>
	);
}

LocationPicker.propTypes = {
	latitude: PropTypes.string,
	longitude: PropTypes.string,
	address: PropTypes.string,
	onChange: PropTypes.func.isRequired,
	socket: PropTypes.object.isRequired,
	instanceId: PropTypes.string.isRequired,
};

export default LocationPicker;
