import { defineConfig } from 'astro/config';

const customDomain = process.env.SITE_URL;

export default defineConfig({
  site: customDomain || 'https://gchaha92.github.io',
  base: customDomain ? undefined : '/gc-lab-92',
  publicDir: './.astro-public',
  output: 'static',
  trailingSlash: 'always',
});
