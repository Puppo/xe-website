import { describe, expect, it } from 'vitest';
import {
  defaultSiteUrl,
  deploymentConfig,
  isSitemapExcluded,
  resolveSiteUrl,
} from '../src/lib/deployment.mjs';

describe('lib/deployment.resolveSiteUrl', () => {
  it('uses SITE_URL when explicitly configured', () => {
    expect(
      resolveSiteUrl({
        DEPLOY_PRIME_URL: 'https://deploy-preview-1--xe.netlify.app',
        SITE_URL: 'https://xedotnet.github.io/website/',
        URL: 'https://xe.netlify.app',
      }),
    ).toBe('https://xedotnet.github.io/website/');
  });

  it('falls back to DEPLOY_PRIME_URL for Netlify Deploy Previews when SITE_URL is unset', () => {
    expect(
      resolveSiteUrl({
        DEPLOY_PRIME_URL: 'https://deploy-preview-42--xe.netlify.app',
        URL: 'https://xe.netlify.app',
      }),
    ).toBe('https://deploy-preview-42--xe.netlify.app');
  });

  it('falls back to Netlify URL when SITE_URL and DEPLOY_PRIME_URL are unset', () => {
    expect(
      resolveSiteUrl({
        URL: 'https://xe-website-preview.netlify.app',
      }),
    ).toBe('https://xe-website-preview.netlify.app');
  });

  it('falls back to defaultSiteUrl when no environment URL is set', () => {
    expect(resolveSiteUrl({})).toBe(defaultSiteUrl);
    expect(resolveSiteUrl({ SITE_URL: '   ' })).toBe(defaultSiteUrl);
  });
});

describe('lib/deployment.deploymentConfig', () => {
  it('resolves the GitHub Pages base path with or without a trailing slash', () => {
    expect(deploymentConfig('https://xedotnet.github.io/website/')).toEqual({
      base: '/website/',
      site: 'https://xedotnet.github.io',
    });
    expect(deploymentConfig('https://xedotnet.github.io/website')).toEqual({
      base: '/website/',
      site: 'https://xedotnet.github.io',
    });
  });

  it('resolves the root domain for xedotnet.org over HTTP/HTTPS and for Netlify previews', () => {
    expect(deploymentConfig('http://xedotnet.org/')).toEqual({
      base: '/',
      site: 'http://xedotnet.org',
    });
    expect(deploymentConfig('https://xedotnet.org/')).toEqual({
      base: '/',
      site: 'https://xedotnet.org',
    });
    expect(
      deploymentConfig('https://deploy-preview-42--xe.netlify.app'),
    ).toEqual({
      base: '/',
      site: 'https://deploy-preview-42--xe.netlify.app',
    });
  });
});

describe('lib/deployment.isSitemapExcluded', () => {
  it('excludes service pages at the root', () => {
    expect(isSitemapExcluded('/grazie/', '/')).toBe(true);
    expect(isSitemapExcluded('/404.html', '/')).toBe(true);
  });

  it('excludes service pages under a base path', () => {
    expect(isSitemapExcluded('/preview/grazie/', '/preview/')).toBe(true);
    expect(isSitemapExcluded('/preview/404.html', '/preview/')).toBe(true);
  });

  it('does not exclude paths that only contain the name as a substring', () => {
    expect(isSitemapExcluded('/eventi/404-fest/', '/')).toBe(false);
    expect(isSitemapExcluded('/eventi/grazie-degli-ospiti/', '/')).toBe(false);
    expect(isSitemapExcluded('/grazie-mile/', '/')).toBe(false);
    expect(isSitemapExcluded('/eventi/', '/')).toBe(false);
  });
});
