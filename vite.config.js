import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

// Sends "/tools" to "/tools/" (and "/admin" to "/admin/") so those pages load instead of the
// home page fallback. Static hosts usually do this redirect themselves.
const SLASH_PAGES = ['/tools', '/admin', '/resources', '/roast']
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

// The Free Tools page is kept out of the GitHub repo, so it is only built when its files exist.
const hasTools = fs.existsSync(path.resolve(import.meta.dirname, 'tools/index.html'))

// In production a Cloudflare Pages Function (functions/api/roast) forwards /api/roast to the roast
// service; the dev and preview servers do the same here.
const roastProxy = {
  '/api/roast': { target: 'https://cyrusbitangcol.com', changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: roastProxy },
  preview: { proxy: roastProxy },
  plugins: [react(), tailwindcss(), toolsSlashPlugin],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Pages: the portfolio (/), Free Tools (/tools/), the admin (/admin/), Resources (/resources/) and the unlisted /roast/.
  build: {
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        ...(hasTools && { tools: path.resolve(import.meta.dirname, 'tools/index.html') }),
        admin: path.resolve(import.meta.dirname, 'admin/index.html'),
        resources: path.resolve(import.meta.dirname, 'resources/index.html'),
        roast: path.resolve(import.meta.dirname, 'roast/index.html'),
      },
    },
  },
})
