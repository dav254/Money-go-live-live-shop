/**
 * ROLE SEPARATION — buyer and seller navigation are separate products.
 *
 * The first version of the Android drawer was one component that branched on
 * the current mode. It worked, but every seller edit had to be re-checked
 * against the buyer menu, and the footer — the one block the two sides must
 * never share — lived two lines away from the buyer's.
 *
 * These tests pin the split: each role owns its own drawer component and its
 * own footer, and neither half of the app may import the other's components.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const buyerDrawer = path.join(MOBILE, 'src/components/buyer/drawer.tsx');
const sellerDrawer = path.join(MOBILE, 'src/components/seller/drawer.tsx');
const sellerHeader = path.join(MOBILE, 'src/components/seller/seller-header.tsx');
const tabsLayout = path.join(MOBILE, 'app/(tabs)/_layout.tsx');

test('buyer and seller each own a drawer component', () => {
  assert.ok(existsSync(buyerDrawer), 'missing src/components/buyer/drawer.tsx');
  assert.ok(existsSync(sellerDrawer), 'missing src/components/seller/drawer.tsx');
  assert.ok(
    !existsSync(path.join(MOBILE, 'src/components/nav/app-drawer.tsx')),
    'the shared app-drawer must stay deleted — one drawer per role',
  );
});

test('each drawer imports only its own navigation list', () => {
  const buyer = readFileSync(buyerDrawer, 'utf8');
  const seller = readFileSync(sellerDrawer, 'utf8');

  assert.match(buyer, /from '\.\/nav'/, 'buyer drawer must read buyer nav');
  assert.doesNotMatch(buyer, /SELLER_NAV|seller\/nav/, 'buyer drawer leaked seller nav');

  assert.match(seller, /from '\.\/nav'/, 'seller drawer must read seller nav');
  assert.doesNotMatch(seller, /BUYER_NAV|buyer\/nav/, 'seller drawer leaked buyer nav');
});

test('the drawers end in different footers', () => {
  const buyer = readFileSync(buyerDrawer, 'utf8');
  const seller = readFileSync(sellerDrawer, 'utf8');

  assert.match(buyer, /YOUR ACCOUNT/);
  assert.match(buyer, /Shopping settings/);
  assert.match(buyer, /Become a seller/);

  assert.match(seller, /THIS SHOP/);
  assert.match(seller, /Shop settings/);
  assert.match(seller, /Back to buying/);

  assert.doesNotMatch(buyer, /Back to buying/, 'buyer footer carried a seller row');
  assert.doesNotMatch(seller, /Become a seller|Shopping settings/, 'seller footer carried a buyer row');
});

test('headers open the drawer that belongs to their side', () => {
  const header = readFileSync(sellerHeader, 'utf8');
  assert.match(header, /SellerDrawer/);
  assert.doesNotMatch(header, /BuyerDrawer/);

  const tabs = readFileSync(tabsLayout, 'utf8');
  assert.match(tabs, /BuyerDrawer/);
  assert.doesNotMatch(tabs, /SellerDrawer/);
});

test('no seller screen imports buyer components, and no buyer screen imports seller ones', () => {
  const sellerScreens = filesUnder(path.join(MOBILE, 'app/seller'));
  const buyerScreens = filesUnder(path.join(MOBILE, 'app')).filter(
    (file) => !file.startsWith(path.join(MOBILE, 'app/seller')),
  );

  for (const file of sellerScreens) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /components\/buyer/,
      `seller screen imports buyer components: ${path.relative(MOBILE, file)}`,
    );
  }

  for (const file of buyerScreens) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /components\/seller/,
      `buyer screen imports seller components: ${path.relative(MOBILE, file)}`,
    );
  }
});
