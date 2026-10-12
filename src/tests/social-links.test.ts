/**
 * SELLER SOCIAL LINKS.
 *
 * The storefront renders `href` values straight from a seller-authored
 * document, so the two things worth pinning are: any platform is accepted
 * (the point of the feature), and only `http(s)` ever comes back out (the
 * security gate). The merge tests exist so the legacy Facebook/Instagram/
 * Twitter columns cannot silently disappear from existing shops.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SOCIAL_LINKS,
  defaultLabelFor,
  isSafeSocialUrl,
  mergeSocialLinks,
  newLinkId,
  normalizeSocialUrl,
  readSocialLinks,
  socialPlatformFor,
  whatsappLinkFor,
} from '@/lib/social-links';

describe('normalizeSocialUrl', () => {
  it('accepts a full https URL unchanged', () => {
    assert.equal(
      normalizeSocialUrl('https://tiktok.com/@dave2545'),
      'https://tiktok.com/@dave2545',
    );
  });

  it('adds https:// to a bare host so the link is not resolved against our origin', () => {
    assert.equal(normalizeSocialUrl('instagram.com/dave'), 'https://instagram.com/dave');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeSocialUrl('  https://x.com/shop  '), 'https://x.com/shop');
  });

  it('keeps http links as http', () => {
    assert.equal(normalizeSocialUrl('http://shop.example/x'), 'http://shop.example/x');
  });

  it('rejects javascript: URLs — the whole reason this function exists', () => {
    assert.equal(normalizeSocialUrl('javascript:alert(1)'), null);
  });

  it('rejects data: and vbscript: URLs', () => {
    assert.equal(normalizeSocialUrl('data:text/html,<script>x</script>'), null);
    assert.equal(normalizeSocialUrl('vbscript:msgbox(1)'), null);
  });

  it('rejects empty input', () => {
    assert.equal(normalizeSocialUrl(''), null);
    assert.equal(normalizeSocialUrl('   '), null);
  });

  it('rejects a bare handle, which is not a link', () => {
    assert.equal(normalizeSocialUrl('@dave2545'), null);
  });

  it('rejects a host with no dot', () => {
    assert.equal(normalizeSocialUrl('localhost/shop'), null);
  });
});

describe('isSafeSocialUrl', () => {
  it('mirrors normalizeSocialUrl', () => {
    assert.equal(isSafeSocialUrl('https://wa.me/254700000000'), true);
    assert.equal(isSafeSocialUrl('javascript:alert(1)'), false);
  });
});

describe('socialPlatformFor', () => {
  it('recognises the platforms the old three fields covered', () => {
    assert.equal(socialPlatformFor('https://facebook.com/shop').id, 'facebook');
    assert.equal(socialPlatformFor('https://www.instagram.com/shop').id, 'instagram');
    assert.equal(socialPlatformFor('https://x.com/shop').id, 'twitter');
    assert.equal(socialPlatformFor('https://wa.me/254700000000').id, 'whatsapp');
  });

  it('recognises platforms the old design had nowhere for', () => {
    assert.equal(socialPlatformFor('https://tiktok.com/@shop').id, 'tiktok');
    assert.equal(socialPlatformFor('https://youtube.com/@shop').id, 'youtube');
    assert.equal(socialPlatformFor('https://t.me/shop').id, 'telegram');
    assert.equal(socialPlatformFor('https://www.linkedin.com/in/shop').id, 'linkedin');
  });

  it('does not match a lookalike domain suffix', () => {
    assert.equal(socialPlatformFor('https://notfacebook.com.evil.example/x').id, 'link');
  });

  it('falls back to a generic link rather than rejecting an unknown host', () => {
    assert.equal(socialPlatformFor('https://mysmallbusiness.example').id, 'link');
  });
});

describe('defaultLabelFor', () => {
  it('derives a readable label from the host', () => {
    assert.equal(defaultLabelFor('https://tiktok.com/@shop'), 'Tiktok');
  });

  it('returns a neutral label for an unparseable URL', () => {
    assert.equal(defaultLabelFor('nonsense'), 'Link');
  });
});

describe('readSocialLinks', () => {
  it('returns an empty list for anything that is not an array', () => {
    assert.deepEqual(readSocialLinks(undefined), []);
    assert.deepEqual(readSocialLinks(null), []);
    assert.deepEqual(readSocialLinks('nope'), []);
    assert.deepEqual(readSocialLinks({ url: 'https://x.com/a' }), []);
  });

  it('skips entries that are not objects or have no usable URL', () => {
    const links = readSocialLinks([
      'nope',
      null,
      { label: 'Bad', url: 'javascript:alert(1)' },
      { label: 'Good', url: 'https://tiktok.com/@shop' },
    ]);
    assert.equal(links.length, 1);
    assert.equal(links[0].label, 'Good');
    assert.equal(links[0].url, 'https://tiktok.com/@shop');
  });

  it('normalizes stored URLs and supplies an id and label when missing', () => {
    const [link] = readSocialLinks([{ url: 'instagram.com/dave' }]);
    assert.equal(link.url, 'https://instagram.com/dave');
    assert.equal(link.label, 'Instagram');
    assert.ok(link.id.length > 0);
  });

  it('stops at the document-size ceiling', () => {
    const many = Array.from({ length: MAX_SOCIAL_LINKS + 12 }, (_, i) => ({
      url: `https://example${i}.com/`,
    }));
    assert.equal(readSocialLinks(many).length, MAX_SOCIAL_LINKS);
  });
});

describe('newLinkId', () => {
  it('generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newLinkId()));
    assert.equal(ids.size, 50);
  });
});

describe('mergeSocialLinks', () => {
  it('returns nothing for a missing shop', () => {
    assert.deepEqual(mergeSocialLinks(null), []);
    assert.deepEqual(mergeSocialLinks(undefined), []);
  });

  it('returns the free-form links for a shop that has them', () => {
    const links = mergeSocialLinks({
      socialLinks: [
        { id: 'a', label: 'TikTok', url: 'https://tiktok.com/@dave2545' },
        { id: 'b', label: 'Telegram', url: 'https://t.me/dave' },
      ],
    });
    assert.deepEqual(
      links.map((l) => l.label),
      ['TikTok', 'Telegram'],
    );
  });

  it('still surfaces legacy fields so an existing shop does not go blank', () => {
    const links = mergeSocialLinks({
      facebookUrl: 'https://facebook.com/dave',
      instagramUrl: 'https://instagram.com/dave',
      twitterUrl: 'https://twitter.com/dave',
      contactWhatsapp: '+254700000000',
    });
    assert.deepEqual(
      links.map((l) => socialPlatformFor(l.url).id),
      ['facebook', 'instagram', 'twitter', 'whatsapp'],
    );
  });

  it('drops a legacy bare handle instead of rendering it as a relative link', () => {
    // The website settings screen still accepts "@dave" in the Instagram box.
    const links = mergeSocialLinks({ instagramUrl: '@dave' });
    assert.deepEqual(links, []);
  });

  it('does not duplicate a link that also exists in a legacy field', () => {
    const links = mergeSocialLinks({
      socialLinks: [{ id: 'a', label: 'Facebook', url: 'https://facebook.com/dave' }],
      facebookUrl: 'https://facebook.com/dave',
    });
    assert.equal(links.length, 1);
  });

  it('honours the ceiling when merging', () => {
    const many = Array.from({ length: MAX_SOCIAL_LINKS }, (_, i) => ({
      id: `l${i}`,
      label: `Link ${i}`,
      url: `https://example${i}.com/`,
    }));
    const links = mergeSocialLinks({ socialLinks: many, facebookUrl: 'https://facebook.com/dave' });
    assert.equal(links.length, MAX_SOCIAL_LINKS);
  });
});

describe('whatsappLinkFor', () => {
  it('finds the WhatsApp link when present', () => {
    const links = mergeSocialLinks({ socialLinks: [{ id: 'a', label: 'WA', url: 'https://wa.me/254700000000' }] });
    assert.equal(whatsappLinkFor(links)?.url, 'https://wa.me/254700000000');
  });

  it('returns undefined when there is none', () => {
    assert.equal(whatsappLinkFor(mergeSocialLinks({ socialLinks: [] })), undefined);
  });
});