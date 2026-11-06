/**
 * Form validation for the Android app.
 *
 * Deliberately local and dependency-free: each rule returns a sentence the
 * screen can print under the field, exactly like the server's own messages so
 * the same problem reads the same way before and after a request.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!EMAIL.test(email)) return 'That email address looks incomplete.';
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Choose a password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Type your password again.';
  if (password !== confirmation) return 'Those passwords do not match.';
  return null;
}

export function validateName(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Tell us your full name.';
  if (name.length < 2) return 'That name looks too short.';
  return null;
}

/** Phone numbers are kept permissive: international formats vary by country. */
export function validatePhone(value: string, required = false): string | null {
  const phone = value.trim();
  if (!phone) return required ? 'Add a phone number buyers can call.' : null;
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) return 'Use digits, spaces, +, - or brackets.';
  return null;
}

export function validateShopName(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Give your shop a name.';
  if (name.length < 2) return 'That name is too short.';
  if (name.length > 80) return 'Keep it under 80 characters.';
  return null;
}

export function validateDescription(value: string, min = 10): string | null {
  const text = value.trim();
  if (!text) return 'Add a description.';
  if (text.length < min) return `Add at least ${min} characters.`;
  return null;
}

export function validatePrice(value: string): string | null {
  const price = Number(value);
  if (!value.trim()) return 'Enter a price.';
  if (!Number.isFinite(price)) return 'Enter a number, for example 1500.';
  if (price < 0) return 'Price cannot be negative.';
  return null;
}

export function validateStock(value: string): string | null {
  if (!value.trim()) return null;
  const stock = Number(value);
  if (!Number.isInteger(stock)) return 'Use a whole number.';
  if (stock < 0) return 'Stock cannot be negative.';
  return null;
}

export function validateUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  if (!/^https?:\/\/[^\s]+\.[^\s]{2,}/i.test(url)) return 'Start the link with https://';
  return null;
}

/** Trim and collapse whitespace — every field is stored clean. */
export function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
