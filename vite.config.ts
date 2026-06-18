import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import solid from 'vite-plugin-solid'
import manifest from './manifest.config'

function dynamicWebAccessibleResourceUrls(): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'bir-soz:dynamic-web-accessible-resource-urls',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      resolvedConfig = config
    },
    async closeBundle() {
      const manifestPath = resolve(
        resolvedConfig.root,
        resolvedConfig.build.outDir,
        'manifest.json',
      )
      const manifestJson = await readFile(manifestPath, 'utf8')
      const outputManifest = JSON.parse(
        manifestJson,
      ) as chrome.runtime.ManifestV3

      for (const resource of outputManifest.web_accessible_resources ?? []) {
        resource.use_dynamic_url = true
      }

      await writeFile(
        manifestPath,
        `${JSON.stringify(outputManifest, null, 2)}\n`,
      )
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    solid(),
    crx({ manifest }),
    dynamicWebAccessibleResourceUrls(),
  ],
  build: {
    target: 'es2022',
    minify: false,
  },
})
