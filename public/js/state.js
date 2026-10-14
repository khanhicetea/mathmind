import * as store from './store.js';

// One live object shared by every module. Import/reset swap its contents in place (see replaceState)
// so `import { state }` bindings never go stale.
export const state = store.load();

export function replaceState(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
}
