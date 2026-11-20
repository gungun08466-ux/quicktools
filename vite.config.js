import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFile, writeFile } from 'node:fs/promises'
import { SITE_URL } from './src/components/seo/siteConfig.js'

function siteUrlPlugin() {
  const replaceSiteUrl = (content) => content.replaceAll('__SITE_URL__', SITE_URL)

  return {
    name: 'quicktools-site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: replaceSiteUrl,
    },
    async closeBundle() {
      for (const file of ['robots.txt', 'sitemap.xml']) {
        const path = new URL(`./dist/${file}`, import.meta.url)
        const content = await readFile(path, 'utf8')
        await writeFile(path, replaceSiteUrl(content))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlPlugin()],
})
