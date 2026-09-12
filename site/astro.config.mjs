import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.dilanjandk.com',
  base: '/',
  trailingSlash: 'always',
  output: 'static',
  outDir: '../dist',
  integrations: [tailwind(), sitemap()],
});
