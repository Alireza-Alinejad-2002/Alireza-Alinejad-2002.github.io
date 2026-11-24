// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://alireza-alinejad-2002.github.io',
  trailingSlash: 'always',
  integrations: [react(), mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex-sans',
      weights: ['400', '500', '600'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: ['400', '500'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
});
