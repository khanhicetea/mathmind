// Entry point: wires the modules together and boots the app.
import * as fx from './fx.js';
import { setLang, translateDom } from './i18n.js';
import { state } from './state.js';
import { $ } from './util.js';
import { registerView, go } from './nav.js';
import { recoverPending } from './game.js';
import { renderHome } from './views/home.js';
import { renderLearn } from './views/learn.js';
import { renderProgress } from './views/progress.js';
import { renderAwards } from './views/awards.js';
import { renderSettings } from './views/settings.js';
import './pwa.js';

fx.configure(state.settings);
setLang(state.settings.lang);
$('pad').classList.toggle('phone', !!state.settings.phonePad);

registerView('home', renderHome);
registerView('learn', renderLearn);
registerView('progress', renderProgress);
registerView('awards', renderAwards);
registerView('settings', renderSettings);

translateDom();
recoverPending();
go('home');
