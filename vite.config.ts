import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { createChatGPTAuth } from './server/chatgpt.js'
import { handleMistakesPdf } from './server/mistakes-pdf.js'

function chatgptPlugin(): Plugin {
  return {
    name: 'login-with-chatgpt',
    configureServer(server) {
      const chatgptAuth = createChatGPTAuth()
      server.middlewares.use('/api/mistakes-pdf', async (request, response) => {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const headers = new Headers()
        for (const [name, value] of Object.entries(request.headers)) {
          for (const item of Array.isArray(value) ? value : value ? [value] : []) headers.append(name, item)
        }
        const result = await handleMistakesPdf(new Request('http://localhost/api/mistakes-pdf', {
          method: request.method,
          headers,
          body: new Uint8Array(Buffer.concat(chunks)),
        }))
        response.statusCode = result.status
        result.headers.forEach((value, name) => response.setHeader(name, value))
        response.end(new Uint8Array(await result.arrayBuffer()))
      })
      server.middlewares.use('/api/chatgpt', async (request, response) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          const headers = new Headers()
          for (const [name, value] of Object.entries(request.headers)) {
            for (const item of Array.isArray(value) ? value : value ? [value] : []) headers.append(name, item)
          }
          const method = request.method ?? 'GET'
          const result = await chatgptAuth.handler(new Request(
            new URL(request.originalUrl ?? request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).href,
            {
              method,
              headers,
              body: method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(Buffer.concat(chunks)),
            },
          ))

          response.statusCode = result.status
          result.headers.forEach((value, name) => {
            if (name !== 'set-cookie') response.setHeader(name, value)
          })
          const cookies = result.headers.getSetCookie()
          if (cookies.length) response.setHeader('set-cookie', cookies)
          if (!result.body) return response.end()

          const reader = result.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            response.write(value)
          }
          response.end()
        } catch (error) {
          server.config.logger.error(String(error))
          response.statusCode = 500
          response.end('ChatGPT handler failed')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), chatgptPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
