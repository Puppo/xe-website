import { defineConfig, svgoOptimizer } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { deploymentConfig } from './src/lib/deployment.mjs';
import rehypeBaseUrls from './scripts/rehype-base-urls.mjs';

const deployment = deploymentConfig(
  process.env.SITE_URL || 'https://www.xedotnet.org/',
);

export default defineConfig({
  ...deployment,
  experimental: {
    svgOptimizer: svgoOptimizer({ multipass: true }),
  },
  integrations: [sitemap()],
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeBaseUrls, { base: deployment.base }]],
    }),
    shikiConfig: { theme: 'github-dark' },
  },
  output: 'static',
  trailingSlash: 'always',
  vite: {
    plugins: [
      ViteImageOptimizer({ includePublic: true, svg: { multipass: true } }),
    ],
  },
});
