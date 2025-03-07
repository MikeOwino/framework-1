import { promises as fsp } from 'node:fs'
import { dirname, resolve } from 'pathe'
import defu from 'defu'
import type { Nuxt, NuxtApp, NuxtPlugin, NuxtTemplate } from '@nuxt/schema'
import { findPath, resolveFiles, normalizePlugin, normalizeTemplate, compileTemplate, templateUtils, tryResolveModule, resolvePath, resolveAlias } from '@nuxt/kit'

import * as defaultTemplates from './templates'
import { getNameFromPath, hasSuffix, uniqueBy } from './utils'

export function createApp (nuxt: Nuxt, options: Partial<NuxtApp> = {}): NuxtApp {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    templates: []
  } as unknown as NuxtApp) as NuxtApp
}

export async function generateApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve app
  await resolveApp(nuxt, app)

  // User templates from options.build.templates
  app.templates = Object.values(defaultTemplates).concat(nuxt.options.build.templates) as NuxtTemplate[]

  // Extend templates with hook
  await nuxt.callHook('app:templates', app)

  // Normalize templates
  app.templates = app.templates.map(tmpl => normalizeTemplate(tmpl))

  // Compile templates into vfs
  const templateContext = { utils: templateUtils, nuxt, app }
  await Promise.all(app.templates.map(async (template) => {
    const contents = await compileTemplate(template, templateContext)

    const fullPath = template.dst || resolve(nuxt.options.buildDir, template.filename!)
    nuxt.vfs[fullPath] = contents

    const aliasPath = '#build/' + template.filename!.replace(/\.\w+$/, '')
    nuxt.vfs[aliasPath] = contents

    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nuxt.vfs[fullPath.replace(/\//g, '\\')] = contents
    }

    if (template.write) {
      await fsp.mkdir(dirname(fullPath), { recursive: true })
      await fsp.writeFile(fullPath, contents, 'utf8')
    }
  }))

  await nuxt.callHook('app:templatesGenerated', app)
}

export async function resolveApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve main (app.vue)
  if (!app.mainComponent) {
    app.mainComponent = await findPath(
      nuxt.options._layers.flatMap(layer => [`${layer.config.srcDir}/App`, `${layer.config.srcDir}/app`])
    )
  }
  if (!app.mainComponent) {
    app.mainComponent = tryResolveModule('@nuxt/ui-templates/templates/welcome.vue')
  }

  // Resolve root component
  if (!app.rootComponent) {
    app.rootComponent = await findPath(['~/app.root', resolve(nuxt.options.appDir, 'components/nuxt-root.vue')])
  }

  // Resolve error component
  if (!app.errorComponent) {
    app.errorComponent = (await findPath(['~/error'])) || resolve(nuxt.options.appDir, 'components/nuxt-error-page.vue')
  }

  // Resolve layouts/ from all config layers
  app.layouts = {}
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    const layoutFiles = await resolveFiles(config.srcDir, `${config.dir?.layouts || 'layouts'}/*{${nuxt.options.extensions.join(',')}}`)
    for (const file of layoutFiles) {
      const name = getNameFromPath(file)
      app.layouts[name] = app.layouts[name] || { name, file }
    }
  }

  // Resolve middleware/ from all config layers
  app.middleware = []
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    const middlewareFiles = await resolveFiles(config.srcDir, `${config.dir?.middleware || 'middleware'}/*{${nuxt.options.extensions.join(',')}}`)
    app.middleware.push(...middlewareFiles.map((file) => {
      const name = getNameFromPath(file)
      return { name, path: file, global: hasSuffix(file, '.global') }
    }))
  }

  // Resolve plugins
  app.plugins = [
    ...nuxt.options.plugins.map(normalizePlugin)
  ]
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    app.plugins.push(...[
      ...(config.plugins || []),
      ...config.srcDir
        ? await resolveFiles(config.srcDir, [
          `${config.dir?.plugins || 'plugins'}/*.{ts,js,mjs,cjs,mts,cts}`,
          `${config.dir?.plugins || 'plugins'}/*/index.*{ts,js,mjs,cjs,mts,cts}`
        ])
        : []
    ].map(plugin => normalizePlugin(plugin as NuxtPlugin)))
  }

  // Normalize and de-duplicate plugins and middleware
  app.middleware = uniqueBy(await resolvePaths(app.middleware, 'path'), 'name')
  app.plugins = uniqueBy(await resolvePaths(app.plugins, 'src'), 'src')

  // Resolve app.config
  app.configs = []
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    const appConfigPath = await findPath(resolve(config.srcDir, 'app.config'))
    if (appConfigPath) {
      app.configs.push(appConfigPath)
    }
  }

  // Extend app
  await nuxt.callHook('app:resolve', app)

  // Normalize and de-duplicate plugins and middleware
  app.middleware = uniqueBy(await resolvePaths(app.middleware, 'path'), 'name')
  app.plugins = uniqueBy(await resolvePaths(app.plugins, 'src'), 'src')
}

function resolvePaths <Item extends Record<string, any>> (items: Item[], key: { [K in keyof Item]: Item[K] extends string ? K : never }[keyof Item]) {
  return Promise.all(items.map(async (item) => {
    if (!item[key]) { return item }
    return {
      ...item,
      [key]: await resolvePath(resolveAlias(item[key]))
    }
  }))
}
