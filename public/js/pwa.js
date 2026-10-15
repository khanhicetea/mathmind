import { $ } from './util.js';
import { toast } from './fx.js';
import { t } from './i18n.js';

let installEvt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  $('btn-install').hidden = false;
});
$('btn-install').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  $('btn-install').hidden = true;
});
window.addEventListener('appinstalled', () => ($('btn-install').hidden = true));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const sw = navigator.serviceWorker;
  let offered = false;
  const offerReload = () => {
    if (offered) return;
    offered = true;
    toast(t('update_ready'), 15000, () => location.reload());
  };
  const check = () => sw.controller?.postMessage('check-update');
  sw.register('sw.js')
    .then((reg) => {
      check();
      // iOS standalone apps resume instead of relaunching, so also check when brought back to the front
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        reg.update().catch(() => {});
        check();
      });
    })
    .catch(() => {});
  sw.addEventListener('message', (e) => e.data === 'updated' && offerReload());
  // a new sw.js (VERSION bump) took over this page
  const hadController = !!sw.controller;
  sw.addEventListener('controllerchange', () => hadController && offerReload());
}
