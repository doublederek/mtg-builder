import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const COLLECTION_PATH = resolve(process.cwd(), 'collection.json')

function collectionApiPlugin(): Plugin {
  return {
    name: 'collection-api',
    configureServer(server) {
      server.middlewares.use('/api/info', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ collectionPath: COLLECTION_PATH }))
      })

      server.middlewares.use('/api/cards', (req, res) => {
        res.setHeader('Content-Type', 'application/json')

        if (req.method === 'GET') {
          const data = existsSync(COLLECTION_PATH)
            ? readFileSync(COLLECTION_PATH, 'utf-8')
            : '[]'
          res.end(data)
          return
        }

        if (req.method === 'PUT') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            writeFileSync(COLLECTION_PATH, JSON.stringify(JSON.parse(body), null, 2))
            res.end('{"ok":true}')
          })
          return
        }

        res.statusCode = 405
        res.end('{"error":"Method not allowed"}')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), collectionApiPlugin()],
})
