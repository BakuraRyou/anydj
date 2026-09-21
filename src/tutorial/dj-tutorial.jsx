import React from 'react';
import {createRoot} from 'react-dom/client';
import Tutorial from 'animatus-tutorial/frontend';
import definition from '../../public/tutorial.json';

// Render the shared component unchanged so all Animatus apps use the same flow.
export function createDJTutorial() {
  const host = document.createElement('div');
  host.dataset.tutorial = definition.id;
  document.body.append(host);
  const root = createRoot(host);
  // Keyboard navigation inside tutorial controls must not trigger deck hotkeys.
  const protectKeys = event => {
    if (event.target.closest('.animatus-tutorial-card, .animatus-tutorial-launcher')) event.stopPropagation();
  };
  document.addEventListener('keydown', protectKeys);
  root.render(<Tutorial definition={definition} />);
  return {destroy() { document.removeEventListener('keydown', protectKeys); root.unmount(); host.remove(); }};
}
