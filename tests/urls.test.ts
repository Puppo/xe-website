import { describe, expect, it } from 'vitest';
import { externalLinkProps, isExternalUrl, withBase } from '../src/lib/urls';

const SITE_ORIGIN = 'https://www.xedotnet.org';

describe('lib/urls.isExternalUrl', () => {
  it('treats http(s) URLs on a different origin as external', () => {
    expect(isExternalUrl('https://example.com/page', SITE_ORIGIN)).toBe(true);
    expect(isExternalUrl('http://example.com/page', SITE_ORIGIN)).toBe(true);
  });

  it('treats http(s) URLs on the same origin as internal', () => {
    expect(isExternalUrl('https://www.xedotnet.org/eventi/', SITE_ORIGIN)).toBe(
      false,
    );
    expect(
      isExternalUrl('https://www.xedotnet.org/eventi/?x=1', SITE_ORIGIN),
    ).toBe(false);
  });

  it('treats site-relative paths as internal even with no base path knowledge', () => {
    expect(isExternalUrl('/eventi/', SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl('./altro', SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl('../altro', SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl('#sezione', SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl('?q=1', SITE_ORIGIN)).toBe(false);
  });

  it('treats mailto/tel/data URIs as non-external', () => {
    expect(isExternalUrl('mailto:staff@xedotnet.org', SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl('tel:+390401234567', SITE_ORIGIN)).toBe(false);
  });

  it('returns false for empty or missing href / origin', () => {
    expect(isExternalUrl('', SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl(undefined, SITE_ORIGIN)).toBe(false);
    expect(isExternalUrl('https://example.com', undefined)).toBe(false);
    expect(isExternalUrl('https://example.com', '')).toBe(false);
  });

  it('returns false for malformed href values', () => {
    expect(isExternalUrl('not a url', SITE_ORIGIN)).toBe(false);
  });

  it('returns false for non-http schemes', () => {
    expect(isExternalUrl('data:text/plain;base64,SGk=', SITE_ORIGIN)).toBe(
      false,
    );
  });
});

describe('lib/urls.externalLinkProps', () => {
  it('returns target=_blank with default rel for external URLs', () => {
    expect(externalLinkProps('https://example.com/page', SITE_ORIGIN)).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('accepts a custom rel value (e.g. me noreferrer for identity links)', () => {
    expect(
      externalLinkProps(
        'https://mastodon.social/@xe',
        SITE_ORIGIN,
        'me noreferrer',
      ),
    ).toEqual({
      target: '_blank',
      rel: 'me noreferrer',
    });
  });

  it('returns an empty props bag for internal links', () => {
    expect(externalLinkProps('/eventi/', SITE_ORIGIN)).toEqual({});
    expect(externalLinkProps('mailto:staff@xedotnet.org', SITE_ORIGIN)).toEqual(
      {},
    );
  });
});

describe('lib/urls.withBase', () => {
  it('keeps external URLs untouched', () => {
    expect(withBase('https://example.com/page')).toBe(
      'https://example.com/page',
    );
  });
});
