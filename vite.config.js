import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// Sends "/tools" to "/tools/" (and "/admin" to "/admin/") so those pages load instead of the
// home page fallback. Static hosts usually do this redirect themselves.
const SLASH_PAGES = ['/tools', '/admin']
const toolsSlash = (req, res, next) => {
  const page = SLASH_PAGES.find((p) => req.url === p || req.url?.startsWith(`${p}?`))
  if (page) {
    res.statusCode = 301
    res.setHeader('Location', req.url.replace(page, `${page}/`))
    res.end()
    return
  }
  next()
}

const toolsSlashPlugin = {
  name: 'trailing-slash-pages',
  // Braces matter: Vite would run a returned value as a post-hook, and `use()` returns the app.
  configureServer(server) {
    server.middlewares.use(toolsSlash)
  },
  configurePreviewServer(server) {
    server.middlewares.use(toolsSlash)
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), toolsSlashPlugin],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Three pages: the portfolio (/), the Free Tools directory (/tools/) and the admin task manager (/admin/).
  build: {
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        tools: path.resolve(import.meta.dirname, 'tools/index.html'),
        admin: path.resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
})
