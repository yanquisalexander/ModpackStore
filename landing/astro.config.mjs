import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
    site: process.env.PUBLIC_SITE_URL ?? 'https://modpackstore.vercel.app',
    integrations: [preact()],
    output: 'static',
    adapter: vercel(),
    compressHTML: true,
    vite: {
        plugins: [tailwindcss()],
    }
});