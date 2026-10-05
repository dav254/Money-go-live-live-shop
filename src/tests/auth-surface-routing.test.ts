/**
 * SURFACE-AWARE HOME ROUTING.
 *
 * The rule: signing in on the installed app opens the app's own section; signing
 * in on the website opens the website. These tests pin both halves, because the
 * bug was that app users were dropped onto `/dashboard/seller` and
 * `/buyer/dashboard` — website routes — the moment they authenticated.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APP_ROLE_HOME, ROLE_HOME, roleHomeFor, type AppRole } from '../lib/auth/roles';

const ROLES: AppRole[] = ['buyer', 'seller', 'reseller', 'admin'];

describe('website homes', () => {
  it('keeps every role on a website route', () => {
    for (const role of ROLES) {
      assert.ok(ROLE_HOME[role].startsWith('/'), `${role} web home`);
      assert.ok(!ROLE_HOME[role].startsWith('/app'), `${role} web home must not be an app route`);
    }
  });
});

describe('app homes', () => {
  it('sends sellers and buyers into their own app section', () => {
    assert.equal(roleHomeFor('seller', 'app'), '/app/seller');
    assert.equal(roleHomeFor('buyer', 'app'), '/app/buyer');
  });

  it('sends a reseller into the seller section — the app has no reseller section', () => {
    assert.equal(roleHomeFor('reseller', 'app'), '/app/seller');
  });

  it('sends an admin to their own console — admins are not an app role', () => {
    assert.equal(roleHomeFor('admin', 'app'), '/admin');
  });

  it('never answers an app sign-in with a website route', () => {
    for (const role of ROLES) {
      assert.ok(
        !roleHomeFor(role, 'app').startsWith('/dashboard') &&
          !roleHomeFor(role, 'app').startsWith('/buyer/'),
        `${role} landed on the website: ${roleHomeFor(role, 'app')}`,
      );
    }
  });

  it('keeps every app home inside the app or the admin console', () => {
    for (const role of ROLES) {
      const home = APP_ROLE_HOME[role];
      assert.ok(
        home.startsWith('/app') || home.startsWith('/admin'),
        `${role} app home is off-surface: ${home}`,
      );
    }
  });
});

describe('the surface decides', () => {
  it('gives the website and the app different homes for the same role', () => {
    for (const role of ['buyer', 'seller', 'reseller'] as AppRole[]) {
      assert.notEqual(roleHomeFor(role, 'web'), roleHomeFor(role, 'app'));
    }
  });

  it('falls back to the website home before the surface is known', () => {
    // `null` is the SSR / first-paint value; guessing the app there would flash
    // the wrong application. The web home renders without a session.
    for (const role of ROLES) {
      assert.equal(roleHomeFor(role, null), ROLE_HOME[role]);
    }
  });

  it('keeps an admin in the admin console when they are on it', () => {
    assert.equal(roleHomeFor('admin', 'admin'), '/admin');
    assert.equal(roleHomeFor('seller', 'admin'), ROLE_HOME.seller);
  });
});