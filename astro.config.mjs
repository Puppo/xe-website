import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { deploymentConfig } from './src/lib/deployment.mjs';
import rehypeBaseUrls from './scripts/rehype-base-urls.mjs';

const deployment = deploymentConfig(process.env.SITE_URL || 'https://www.xedotnet.org/');

export default defineConfig({
  ...deployment,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    processor: unified({ rehypePlugins: [[rehypeBaseUrls, { base: deployment.base }]] }),
    shikiConfig: { theme: 'github-dark' }
  }
});
