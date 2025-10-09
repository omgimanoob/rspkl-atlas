import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET

  const proxyRoutes = ['/auth', '/me', '/projects', '/timesheets', '/bi', '/overrides', '/sync', '/healthz']
  const proxy: Record<string, any> = {}
  if (target) {
    proxyRoutes.forEach((p) => {
      proxy[p] = { target, changeOrigin: true }
    })
  } else {
    // No proxy configured; requests must be same-origin in dev
    console.warn('[client] VITE_API_TARGET not set. Dev requests must hit same origin.')
  }

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT || 5173),
      proxy,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    preview: {
      port: Number(env.VITE_PORT || 5173),
    },
  }
})
