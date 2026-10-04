/**
 * FIRESTORE CONNECTIVITY LOG FILTER.
 *
 * The filter hides one specific class of message: the SDK saying it lost the
 * network and is retrying. These tests pin both halves of the contract — that
 * message is dropped, and that nothing else is. The second half matters more:
 * a filter that also swallowed real errors would hide bugs indefinitely.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFirebaseStack,
  isTransientConnectivityText,
  shouldSuppressConnectivityLog,
} from '../firebase/connectivity-log-filter';

/** A stack shaped like the webpack browser build, ending in an SDK frame. */
const SDK_STACK = [
  'Error',
  '    at Logger.defaultLogHandler [as _logHandler] (webpack-internal:///./node_modules/@firebase/logger/dist/esm/index.esm2017.js:85:24)',
  '    at Logger.error (webpack-internal:///./node_modules/@firebase/logger/dist/esm/index.esm2017.js:168:14)',
].join('\n');

/** The same shape, but the call comes from application code. */
const APP_STACK = [
  'Error',
  '    at saveProduct (webpack-internal:///./src/app/products/[productId]/page.tsx:113:20)',
].join('\n');

/** The verbatim message from the reported browser error. */
const OFFLINE_MESSAGE =
  'Firestore (11.10.0): Could not reach Cloud Firestore backend. ' +
  'Connection failed 1 times. Most recent error: FirebaseError: [code=unknown]: ' +
  'Fetching auth token failed: Firebase: Error (auth/network-request-failed).\n' +
  'This typically indicates that your device does not have a healthy Internet ' +
  'connection at the moment. The client will operate in offline mode until it ' +
  'is able to successfully connect to the backend.';

describe('transient connectivity text', () => {
  it('recognises the Firestore "could not reach backend" message', () => {
    assert.equal(isTransientConnectivityText(OFFLINE_MESSAGE), true);
  });

  it('recognises a bare auth token fetch failure', () => {
    assert.equal(
      isTransientConnectivityText('Fetching auth token failed: Firebase: Error (auth/network-request-failed).'),
      true,
    );
  });

  it('does not treat a permission denial as connectivity noise', () => {
    assert.equal(
      isTransientConnectivityText('Missing or insufficient permissions.'),
      false,
    );
  });

  it('does not treat a missing composite index as connectivity noise', () => {
    assert.equal(
      isTransientConnectivityText(
        'The query requires an index. You can enable it here: https://console.firebase.google.com',
      ),
      false,
    );
  });

  it('does not treat ordinary internal errors as connectivity noise', () => {
    assert.equal(
      isTransientConnectivityText('Firestore (11.10.0): Internal error during Listen operation'),
      false,
    );
  });
});

describe('firebase stack detection', () => {
  it('matches an SDK frame', () => {
    assert.equal(isFirebaseStack(SDK_STACK), true);
  });

  it('does not match an application frame', () => {
    assert.equal(isFirebaseStack(APP_STACK), false);
  });

  it('does not match a missing stack', () => {
    assert.equal(isFirebaseStack(undefined), false);
    assert.equal(isFirebaseStack(null), false);
  });
});

describe('suppression decision', () => {
  it('drops the offline error reported from the browser', () => {
    assert.equal(shouldSuppressConnectivityLog([OFFLINE_MESSAGE], SDK_STACK), true);
  });

  it('drops the same message logged as an Error object', () => {
    const error = Object.assign(new Error(OFFLINE_MESSAGE), { code: 'unknown' });
    assert.equal(shouldSuppressConnectivityLog([error], SDK_STACK), true);
  });

  it('keeps a permission denial coming from the SDK', () => {
    const error = Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    });
    assert.equal(shouldSuppressConnectivityLog([error], SDK_STACK), false);
  });

  it('keeps a failed-precondition (missing index) from the SDK', () => {
    assert.equal(
      shouldSuppressConnectivityLog(['The query requires an index.'], SDK_STACK),
      false,
    );
  });

  it('keeps the offline message when our own code logged it', () => {
    assert.equal(shouldSuppressConnectivityLog([OFFLINE_MESSAGE], APP_STACK), false);
  });

  it('keeps everything else the SDK logs', () => {
    assert.equal(shouldSuppressConnectivityLog(['Internal error'], SDK_STACK), false);
  });

  it('keeps a call with no arguments', () => {
    assert.equal(shouldSuppressConnectivityLog([], SDK_STACK), false);
  });
});