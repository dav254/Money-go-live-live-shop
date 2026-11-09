/**
 * MENU BUS — the buyer drawer lives in the tab layout, but the Discovery
 * header (its own component, with its own logo and search) is the one that
 * shows the menu button. Rather than lifting drawer state into a context that
 * every screen would re-render on, the header announces "open" and the layout
 * that owns the drawer listens. Buyer-side only: the seller header opens the
 * seller drawer directly.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function openBuyerMenu(): void {
  for (const listener of listeners) listener();
}

export function subscribeBuyerMenu(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
