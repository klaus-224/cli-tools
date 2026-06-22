import type { Plugin } from 'vite'
import { handleApiRequest } from './routes'

export const sessionApiPlugin = (): Plugin => ({
  name: 'session-api-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const handled = await handleApiRequest(req, res)
      if (!handled) next()
    })
  },
})
