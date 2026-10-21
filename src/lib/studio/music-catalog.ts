/**
 * MUSIC CATALOGUE — the licensing boundary for Living Pictures (spec §B2).
 *
 * ## The rule this module exists to enforce
 *
 * A Living Picture may carry music ONLY from a track whose licence has been
 * verified for marketplace use. Nothing here fetches, scrapes, or invents
 * audio. A track appears in the catalogue only if it was registered with a
 * concrete, checkable licence record — no licence, no track. If the catalogue
 * is empty, the feature is honest about it: the UI reads
 * `catalogueAvailability()` and shows "Music not available yet" with the exact
 * requirement to activate it, rather than fabricating tracks or simulating
 * playback.
 *
 * ## Where tracks come from
 *
 * This ships EMPTY on purpose. Vidnov has no pre-existing authorised audio
 * source (verified in Stage 1: the media engine can STORE audio, but there is
 * no catalogue of licensed tracks anywhere in the repo). Populating it is a
 * content/legal step, not a code step: drop licensed files under
 * `public/music/` (or a served media folder) and register each one below (or
 * load them from a Firestore `musicCatalog` collection via an admin screen).
 * Every entry MUST carry a real licence — the type makes an empty licence
 * unrepresentable, so a track cannot be smuggled in without one.
 *
 * ## What is deliberately NOT here
 *
 *   • No third-party streaming SDK. Adding one would mean trusting its
 *     licensing terms on behalf of the marketplace; the brief forbids treating
 *     a public URL as proof of permission. An approved provider can be wired
 *     in later behind `CatalogueTrack.source` without changing any caller.
 *   • No client-side secret. The catalogue is public metadata (title, artist,
 *     licence, stream URL). Provider keys, if ever added, stay server-side.
 */

/**
 * The licence record that MUST accompany every track. This is the gate: a
 * track with no licence is not a track, it is a liability, and the type
 * enforces that by requiring these fields.
 */
export interface TrackLicence {
  /** SPDX-style identifier or short name, e.g. "CC0-1.0", "Vidnov owned". */
  licenceId: string;
  /** Human-readable terms summary shown to the seller. */
  summary: string;
  /** Who granted the licence / owns the track. */
  licensor: string;
  /**
   * Verified for commercial, marketplace, worldwide, perpetual playback and
   * redistribution. Each flag is checked by `verifyLicence()`; a track that
   * fails any is treated as unavailable even if it is in the list, so a
   * half-licensed track can never reach a published Living Picture.
   */
  allowsCommercialUse: boolean;
  allowsMarketplaceUse: boolean;
  allowsWorldwide: boolean;
  allowsRedistribution: boolean;
}

export interface CatalogueTrack {
  id: string;
  title: string;
  artist: string;
  /** Duration in seconds (metadata only — never used to fake playback). */
  durationSeconds: number;
  /**
   * Where the bytes are served from. A same-origin path (e.g.
   * `/music/track.mp3` or a `/api/media/file/...` URL) is preferred so the
   * browser caches it and does not re-download per view (spec §B3).
   */
  streamUrl: string;
  /** MIME type of the audio, e.g. "audio/mpeg". */
  mimeType: string;
  licence: TrackLicence;
}

/**
 * A licence passes only when EVERY intended use is granted. This is the single
 * gate every catalogue read funnels through, so a permissive-looking track
 * with one missing right (say, no redistribution) is still withheld.
 */
export function verifyLicence(licence: TrackLicence | null | undefined): boolean {
  if (!licence) return false;
  return (
    licence.allowsCommercialUse === true &&
    licence.allowsMarketplaceUse === true &&
    licence.allowsWorldwide === true &&
    licence.allowsRedistribution === true &&
    typeof licence.licenceId === 'string' &&
    licence.licenceId.trim() !== '' &&
    typeof licence.licensor === 'string' &&
    licence.licensor.trim() !== ''
  );
}

/**
 * The registered catalogue. Ships empty — see the module note. An admin
 * surface or a Firestore-backed loader appends to this at runtime; it is a
 * mutable array so a future admin screen can register a track without a
 * redeploy of this module's logic.
 */
const REGISTERED: CatalogueTrack[] = [];

/** Register a licensed track. Returns false (and stores nothing) if unlicensed. */
export function registerTrack(track: CatalogueTrack): boolean {
  if (!verifyLicence(track.licence)) return false;
  if (!track.streamUrl || typeof track.streamUrl !== 'string') return false;
  if (REGISTERED.some((t) => t.id === track.id)) return false;
  REGISTERED.push(track);
  return true;
}

/** Remove a track (e.g. a licence lapses). Returns true if it was present. */
export function unregisterTrack(id: string): boolean {
  const index = REGISTERED.findIndex((t) => t.id === id);
  if (index === -1) return false;
  REGISTERED.splice(index, 1);
  return true;
}

/**
 * Every track currently cleared for use. Unlicensed entries are filtered out
 * on read as a second line of defence — even if something bypassed
 * `registerTrack`, it cannot surface here.
 */
export function listAvailableTracks(): CatalogueTrack[] {
  return REGISTERED.filter((t) => verifyLicence(t.licence));
}

/** Look up one cleared track by id, or null. */
export function getTrack(id: string | null | undefined): CatalogueTrack | null {
  if (!id) return null;
  return listAvailableTracks().find((t) => t.id === id) ?? null;
}

export interface CatalogueAvailability {
  available: boolean;
  trackCount: number;
  /** Shown to the seller when unavailable — the exact activation requirement. */
  reason: string;
}

/**
 * Whether the catalogue can serve music at all. The Living Pictures creation
 * flow reads this: when `available` is false the "Add Music" control renders
 * in a clearly-labelled unavailable state with the reason, and publishing a
 * music-less Living Picture stays fully functional.
 */
export function catalogueAvailability(): CatalogueAvailability {
  const tracks = listAvailableTracks();
  if (tracks.length === 0) {
    return {
      available: false,
      trackCount: 0,
      reason:
        'No licensed music is available yet. To activate, add tracks Vidnov owns or has written permission to licence, place the audio files under /public/music/, and register each with its licence (commercial + marketplace + worldwide + redistribution) in src/lib/studio/music-catalog.ts or the admin music screen.',
    };
  }
  return { available: true, trackCount: tracks.length, reason: '' };
}

/**
 * Validate that a Living Picture's chosen track is still cleared. Called at
 * publish time so a track whose licence lapsed between selection and publish
 * is caught before it reaches a live document.
 */
export function isTrackPublishable(trackId: string | null | undefined): boolean {
  return getTrack(trackId) !== null;
}
