import { defineConfig, loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'

/** Read a request's JSON body; empty body resolves to `{}`. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (raw === '') return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/** Wrap a Node response in the minimal `{ status, json }` shape the handler expects. */
function toVercelResponse(res: ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code
      return this
    },
    json(body: unknown) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    },
  }
}

/**
 * Dev-only: serve the Vercel serverless functions in `api/` during `vite dev`,
 * so `npm run dev` runs the app and the API together. Production is unaffected —
 * Vercel runs the same handler files itself, and this plugin (`apply: 'serve'`)
 * never runs during `vite build`.
 */
function vercelApiDevServer(): Plugin {
  return {
    name: 'vercel-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/targets', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const body = await readJsonBody(req)
          const module = await server.ssrLoadModule('/api/targets.ts')
          const handler = module.default as (
            req: { method?: string; body?: unknown },
            res: ReturnType<typeof toVercelResponse>,
          ) => Promise<void>
          await handler({ method: req.method, body }, toVercelResponse(res))
        } catch (error) {
          server.config.logger.error(`[api/targets] dev handler failed: ${String(error)}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Local API middleware failed.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode, command }) => {
  // In dev, load .env values the API handler reads from process.env. Empty
  // entries (e.g. `AI_BASE_URL=`) are skipped so the handler's defaults apply.
  if (command === 'serve') {
    const env = loadEnv(mode, process.cwd(), '')
    for (const key of ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL']) {
      if (env[key]) process.env[key] = env[key]
    }
  }

  return {
    plugins: [react(), vercelApiDevServer()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/engine/**/*.ts'],
        exclude: ['src/engine/**/*.test.ts'],
      },
    },
  }
})
