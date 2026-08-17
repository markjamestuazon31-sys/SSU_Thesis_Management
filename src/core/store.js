const state = { authReady: false, currentUser: null, profile: null };
const listeners = new Set();
export const store = {
  getState: () => ({ ...state }),
  setState(patch) { Object.assign(state, patch); listeners.forEach((fn) => fn({ ...state })); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
