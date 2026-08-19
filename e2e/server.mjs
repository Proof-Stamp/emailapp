import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '../dist')
const port = 4173

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname)
  const requested = decoded === '/' || decoded === '/verify' ? '/index.html' : decoded
  const target = resolve(root, `.${requested}`)
  return target === root || target.startsWith(`${root}${sep}`) ? target : null
}

createServer(async (request, response) => {
  try {
    let target = safePath(new URL(request.url, `http://${request.headers.host}`).pathname)
    if (!target) {
      response.writeHead(400)
      response.end('Bad request')
      return
    }

    try {
      const info = await stat(target)
      if (info.isDirectory()) target = resolve(target, 'index.html')
    } catch {
      target = resolve(root, 'index.html')
    }

    const body = await readFile(target)
    response.writeHead(200, {
      'content-type': contentTypes[extname(target)] || 'application/octet-stream',
      'cache-control': 'no-store'
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch (error) {
    response.writeHead(500)
    response.end(String(error))
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`ProofStamp test server listening on http://127.0.0.1:${port}`)
})
