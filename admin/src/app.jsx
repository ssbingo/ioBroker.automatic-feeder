import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { GenericApp } from '@iobroker/adapter-react-v5';

import Settings from './components/Settings';

import en from './i18n/en.json';
import de from './i18n/de.json';
import ru from './i18n/ru.json';
import pt from './i18n/pt.json';
import nl from './i18n/nl.json';
import fr from './i18n/fr.json';
import it from './i18n/it.json';
import es from './i18n/es.json';
import pl from './i18n/pl.json';
import uk from './i18n/uk.json';
import zhCn from './i18n/zh-cn.json';

class App extends GenericApp {
	constructor(props) {
		const extendedProps = {
			...props,
			encryptedFields: [],
			translations: {
				en,
				de,
				ru,
				pt,
				nl,
				fr,
				it,
				es,
				pl,
				uk,
				'zh-cn': zhCn,
			},
		};
		super(props, extendedProps);
	}

	render() {
		if (!this.state.loaded) {
			return super.render();
		}

		// Wrap the whole UI in the theme GenericApp has already resolved from the admin
		// (this.state.theme / themeType). Without this the tabs and labels would inherit the
		// outer theme from index.jsx, which is fixed at module load (Utils.getThemeName()) and
		// is often still "light" on first render — so in dark mode the tab labels render as
		// dark text on a dark background until an interaction re-themes them.
		return (
			<StyledEngineProvider injectFirst>
				<ThemeProvider theme={this.state.theme}>
					<div
						className="App"
						style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
					>
						<div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
							<Settings
								native={this.state.native}
								onChange={(attr, value) => this.updateNativeValue(attr, value)}
								socket={this.socket}
								theme={this.state.theme}
								themeType={this.state.themeType}
								themeName={this.state.themeName}
								instanceId={`${this.adapterName}.${this.instance}`}
							/>
						</div>
						{this.renderError()}
						{this.renderToast()}
						{this.renderSaveCloseButtons()}
					</div>
				</ThemeProvider>
			</StyledEngineProvider>
		);
	}
}

export default App;
