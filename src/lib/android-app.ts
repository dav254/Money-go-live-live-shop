/**
 * THE ANDROID APP — one source of truth for every install surface.
 *
 * The website must never invent a download. Until the signed release is live on
 * Google Play there is no URL to point at, so every surface asks this module
 * instead of hardcoding a link: while `PLAY_STORE_URL` is empty they show
 * "coming soon" and link to the permanent `/download` page, which explains the
 * real status. The moment the store listing exists, setting
 * `NEXT_PUBLIC_PLAY_STORE_URL` in the environment switches the whole site to the
 * verified official listing — no code change, no fake button in the meantime.
 *
 * Why an env var rather than a constant: the Play URL contains the app id, and
 * the app id is a production fact (set in `mobile/app.json`) that may change
 * before the first upload. A constant here would be a guess baked into the
 * bundle; an env var is a deployment decision that can be corrected without a
 * rebuild of the copy around it.
 */

/** Play Store listing URL — only ever what the operator configured. */
export const PLAY_STORE_URL = (process.env.NEXT_PUBLIC_PLAY_STORE_URL || '').trim();

/** The permanent download page. Always this origin — never a redirect to the app. */
export const DOWNLOAD_PAGE_PATH = '/download';

/** Android application id — kept in step with `mobile/app.json` (`expo.android.package`). */
export const ANDROID_PACKAGE_ID = 'com.vidnov.app';

/** Display metadata. Version fields mirror `mobile/app.json` / `mobile/eas.json`. */
export const ANDROID_APP = {
  name: 'Vidnov',
  packageId: ANDROID_PACKAGE_ID,
  versionName: '1.0.0',
  versionCode: 1,
  /**
   * Expo SDK 54+ raises the Android floor to API 24. Stated as a range people
   * recognise rather than an API number alone.
   */
  minimumAndroid: 'Android 7.0 (API level 24) or newer',
  /** Rough installed size of a release build; stated so it is not a surprise. */
  approximateSize: 'Under 40 MB',
  iconPath: '/icons/icon-512.png',
} as const;

/** True only when a real, verified store listing exists. */
export const IS_PUBLISHED = PLAY_STORE_URL.length > 0;

/**
 * Where a QR code on a desktop screen should send a phone.
 *
 * Published → the official Play listing (the only genuinely installable target).
 * Not published → this site's own download page, which tells the truth about
 * availability. Never a raw APK: an unsigned sideload is not something the
 * website should hand out, and Play requires the signed bundle anyway.
 */
export const QR_TARGET_URL = IS_PUBLISHED
  ? PLAY_STORE_URL
  : 'https://vidnov.com/download';

/** Copy used by the button, shared so two surfaces cannot disagree. */
export function installCtaLabel(): string {
  return IS_PUBLISHED ? 'Get it on Google Play' : 'Android app coming soon';
}
