'use client';
import { type User } from 'firebase/auth';
import { getSurfaceAuth } from './surface-auth';

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface FirebaseAuthToken {
  name: string | null;
  email: string | null;
  email_verified: boolean;
  phone_number: string | null;
  sub: string;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
    tenant: string | null;
  };
}

interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds a security-rule-compliant auth object from the Firebase User.
 * @param currentUser The currently authenticated Firebase user.
 * @returns An object that mirrors request.auth in security rules, or null.
 */
function buildAuthObject(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) {
    return null;
  }

  const token: FirebaseAuthToken = {
    name: currentUser.displayName,
    email: currentUser.email,
    email_verified: currentUser.emailVerified,
    phone_number: currentUser.phoneNumber,
    sub: currentUser.uid,
    firebase: {
      identities: currentUser.providerData.reduce((acc, p) => {
        if (p.providerId) {
          acc[p.providerId] = [p.uid];
        }
        return acc;
      }, {} as Record<string, string[]>),
      sign_in_provider: currentUser.providerData[0]?.providerId || 'custom',
      tenant: currentUser.tenantId,
    },
  };

  return {
    uid: currentUser.uid,
    token: token,
  };
}

/**
 * Builds the complete, simulated request object for the error message.
 * It safely tries to get the current authenticated user.
 * @param context The context of the failed Firestore operation.
 * @returns A structured request object.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  let authObject: FirebaseAuthObject | null = null;
  try {
    // Safely attempt to get the current user.
    const firebaseAuth = getSurfaceAuth();
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      authObject = buildAuthObject(currentUser);
    }
  } catch {
    // This will catch errors if the Firebase app is not yet initialized.
    // In this case, we'll proceed without auth information.
  }

  return {
    auth: authObject,
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

/**
 * Builds the final, formatted error message for the LLM.
 * @param requestObject The simulated request object.
 * @returns A string containing the error message and the JSON payload.
 */
function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(requestObject, null, 2)}`;
}

/**
 * A custom error class designed to be consumed by an LLM for debugging.
 * It structures the error information to mimic the request object
 * available in Firestore Security Rules.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = 'FirebaseError';
    this.request = requestObject;
  }
}

/**
 * The backend could not be reached, so the read never happened.
 *
 * ## Why this class exists at all
 *
 * `FirestorePermissionError` has one message, and it says the request "was
 * denied by Firestore Security Rules". That is only true for one failure mode.
 * Both read hooks used to wrap EVERY `onSnapshot` error in it, so a dropped
 * connection produced a page telling the user their rules blocked them — and
 * chasing security rules that were already correct is a genuinely expensive
 * waste of an afternoon. The comment in `use-collection` records that this
 * already happened once, with a missing composite index.
 *
 * This class is the honest report for the other failure mode: the request never
 * reached Firestore, the rules were never evaluated, and the SDK is already
 * retrying on its own backoff. Callers that distinguish the two can say
 * "reconnecting" instead of "you are not allowed", and — critically — a
 * transient blip does not raise the global "data could not be loaded" banner,
 * which is reserved for real rule denials.
 */
export class FirestoreUnavailableError extends Error {
  /** The SDK's own error code, kept so callers can branch on it if needed. */
  public readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(
      `Firestore could not be reached (${code}). This is a connection problem, not a ` +
        `permissions problem — the request never reached Firestore and your security ` +
        `rules were never evaluated. The app stays offline and retries automatically.`,
    );
    this.name = 'FirebaseError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Failures that mean the request reached Firestore and the rules were evaluated.
 *
 * `permission-denied` is the only true denial. `failed-precondition` is the
 * missing-composite-index case: it is a schema problem the developer must fix,
 * not something a user or a rules deployment caused, and it is kept on the
 * rules side so it keeps surfacing loudly rather than being filed as a blip.
 */
const RULE_FAILURE_CODES = new Set(['permission-denied', 'failed-precondition']);

/**
 * Turn an SDK error into the right report for what actually happened.
 *
 * Everything not in `RULE_FAILURE_CODES` — `unavailable` (backend unreachable),
 * `unauthenticated` (the auth token could not be fetched), `deadline-exceeded`,
 * `internal`, and any code a future SDK adds — is treated as unavailability.
 * That default is deliberate: guessing "denied" and being wrong sends a
 * developer off to audit working security rules, while guessing "connection"
 * when it really was a denial costs one confusing screen, and `cause` keeps
 * the SDK's own error attached either way.
 *
 * `isDenied` is false for every non-rule failure, which is what stops a
 * transient network drop from raising the global permission banner.
 */
export function classifyFirestoreError(
  sdkError: { code?: string } | null | undefined,
  context: SecurityRuleContext,
): { error: FirestorePermissionError | FirestoreUnavailableError; isDenied: boolean } {
  const code = sdkError?.code ?? 'unknown';

  if (RULE_FAILURE_CODES.has(code)) {
    const permissionError = new FirestorePermissionError(context);
    // Keep the real SDK error: the specific code (e.g. failed-precondition for
    // a missing index) is the actionable part.
    permissionError.cause = sdkError;
    return { error: permissionError, isDenied: true };
  }

  return { error: new FirestoreUnavailableError(code, sdkError), isDenied: false };
}
