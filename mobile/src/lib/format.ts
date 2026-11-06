/**
 * Display formatting for the Android app.
 *
 * Everything is defensive: documents are written by the website, the seller
 * dashboard and older schema generations, so a status the app has never seen
 * must render as readable text rather than disappearing.
 */

/** `1234.5` + `NGN` → `NGN 1,234.5`. No symbol guessing from a country code. */
export function money(amount?: number | null, currency?: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const code = (currency || '').toUpperCase();
  const value = amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return code ? `${code} ${value}` : value;
}

/** ISO string → `12 Mar 2026`. */
export function shortDate(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ISO string → `12 Mar, 14:05`, or `14:05` for today. */
export function messageTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Order status → the phrase a person expects, plus a tone for the badge. */
export function orderStatus(status?: string | null): {
  label: string;
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
} {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return { label: 'Awaiting payment', tone: 'warning' };
    case 'paid':
      return { label: 'Paid', tone: 'primary' };
    case 'processing':
      return { label: 'Preparing', tone: 'primary' };
    case 'packed':
      return { label: 'Packed', tone: 'primary' };
    case 'shipped':
      return { label: 'On the way', tone: 'primary' };
    case 'delivery':
      return { label: 'Out for delivery', tone: 'primary' };
    case 'delivered':
      return { label: 'Delivered', tone: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger' };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' };
    case 'disputed':
      return { label: 'In dispute', tone: 'danger' };
    default:
      return { label: status ? titleCase(status) : 'Unknown', tone: 'neutral' };
  }
}

/**
 * The seller-side next step for an order, or null when there is none.
 *
 * Mirrors the transitions `PUT /api/seller/orders/[id]/status` actually allows
 * — offering a button the server will reject is worse than offering none.
 */
export function nextSellerAction(status?: string | null): { status: string; label: string } | null {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return { status: 'processing', label: 'Accept order' };
    case 'paid':
      return { status: 'processing', label: 'Start preparing' };
    case 'processing':
      return { status: 'shipped', label: 'Mark as shipped' };
    case 'shipped':
      return { status: 'delivery', label: 'Out for delivery' };
    case 'delivery':
      return { status: 'delivered', label: 'Mark delivered' };
    case 'disputed':
      return { status: 'processing', label: 'Resume order' };
    default:
      return null;
  }
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Trim text to a preview length without cutting a word in half. */
export function preview(text?: string | null, max = 90): string {
  const value = (text || '').trim().replace(/\s+/g, ' ');
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > 40 ? cut.slice(0, space) : cut).trim()}…`;
}

/** A stable, collision-resistant id for one outgoing chat message. */
export function clientMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
