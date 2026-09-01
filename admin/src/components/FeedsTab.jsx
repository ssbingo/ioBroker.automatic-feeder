import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Typography, TextField, Button, IconButton, Tooltip, Collapse } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
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

let feedSeq = 0;
/** Creates a stable, collision-free id for a new feed entry. */
function makeFeedId() {
	feedSeq += 1;
	return `feed_${Date.now().toString(36)}${feedSeq.toString(36)}`;
}

const num = (v) => Math.max(0, Number(v) || 0);

/**
 * Central, user-maintained feed list (own tab): each entry has a name, vendor, pellet size and the
 * four standard nutritional values (crude protein/fat/fibre/ash, from the manufacturer's specs);
 * the offer/purchase link is an optional, collapsed field. Each switch selects its currently loaded
 * feed from this list (SwitchTab). Stored as the global native.feeds array.
 */
function FeedsTab(props) {
	const { native, onChange } = props;
	const feeds = Array.isArray(native.feeds) ? native.feeds : [];
	const [openUrl, setOpenUrl] = useState({});

	const update = (i, patch) => onChange('feeds', feeds.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
	const add = () =>
		onChange('feeds', [
			...feeds,
			{ id: makeFeedId(), name: '', vendor: '', size: 0, protein: 0, fat: 0, fibre: 0, ash: 0, url: '' },
		]);
	const remove = (i) => onChange('feeds', feeds.filter((_, idx) => idx !== i));

	const nutrient = (f, i, key, label) => (
		<TextField
			label={label}
			type="number"
			value={f[key] ?? 0}
			onChange={(e) => update(i, { [key]: num(e.target.value) })}
			size="small"
			sx={{ width: 130 }}
			inputProps={{ min: 0, step: 0.1 }}
		/>
	);

	return (
		<Box sx={{ p: 2, pb: 10 }}>
			<Section title={I18n.t('Feed list')}>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					{I18n.t(
						'Maintain your food types here. Enter name, vendor, pellet size and the nutritional values from the manufacturer. Each switch picks its currently loaded feed from this list.',
					)}
				</Typography>

				{feeds.length === 0 ? (
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						{I18n.t('No feeds yet — add your first food type.')}
					</Typography>
				) : null}

				{feeds.map((f, i) => (
					<Paper key={f.id || i} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
							<TextField
								label={I18n.t('Feed name')}
								value={f.name ?? ''}
								onChange={(e) => update(i, { name: e.target.value })}
								size="small"
								sx={{ flex: '2 1 180px' }}
							/>
							<TextField
								label={I18n.t('Vendor / dealer')}
								value={f.vendor ?? ''}
								onChange={(e) => update(i, { vendor: e.target.value })}
								size="small"
								sx={{ flex: '2 1 160px' }}
							/>
							<TextField
								label={I18n.t('Pellet size (mm)')}
								type="number"
								value={f.size ?? 0}
								onChange={(e) => update(i, { size: num(e.target.value) })}
								size="small"
								sx={{ width: 130 }}
								inputProps={{ min: 0, step: 0.5 }}
							/>
							<Box sx={{ flex: '1 1 auto' }} />
							<Tooltip title={I18n.t('Offer / purchase link (optional)')}>
								<IconButton
									size="small"
									color={f.url ? 'primary' : 'default'}
									onClick={() => setOpenUrl((o) => ({ ...o, [f.id]: !o[f.id] }))}
								>
									<LinkIcon fontSize="small" />
								</IconButton>
							</Tooltip>
							<Tooltip title={I18n.t('Remove feed')}>
								<IconButton size="small" onClick={() => remove(i)}>
									<DeleteIcon fontSize="small" />
								</IconButton>
							</Tooltip>
						</Box>

						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
							{nutrient(f, i, 'protein', I18n.t('Crude protein (%)'))}
							{nutrient(f, i, 'fat', I18n.t('Crude fat (%)'))}
							{nutrient(f, i, 'fibre', I18n.t('Crude fibre (%)'))}
							{nutrient(f, i, 'ash', I18n.t('Crude ash (%)'))}
						</Box>

						<Collapse in={!!openUrl[f.id]}>
							<TextField
								label={I18n.t('Offer / purchase link')}
								value={f.url ?? ''}
								onChange={(e) => update(i, { url: e.target.value })}
								size="small"
								fullWidth
								placeholder="https://…"
								sx={{ mt: 1.5 }}
							/>
						</Collapse>
					</Paper>
				))}

				<Button startIcon={<AddIcon />} onClick={add} variant="outlined" size="small">
					{I18n.t('Add feed')}
				</Button>
			</Section>
		</Box>
	);
}

FeedsTab.propTypes = {
	native: PropTypes.object.isRequired,
	onChange: PropTypes.func.isRequired,
};

export default FeedsTab;
