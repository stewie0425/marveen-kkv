import { existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { serveFile } from '../http-helpers.js'
import type { RouteContext } from './types.js'

// Serve the built React app from web-react/dist. The legacy vanilla-JS
// dashboard at web-legacy/ stays available as a fallback for the few
// asset paths the old shell hard-codes (/style.css, /app.js) so a stale
// browser tab does not 404 mid-migration. Once feature parity is
// confirmed, the legacy directory and the legacyWebDir param can go.
//
// Path -> source mapping:
//   /                     -> webDir/index.html
//   /index.html           -> webDir/index.html
//   /assets/<x>           -> webDir/assets/<x>          (Vite-hashed bundles)
//   /avatars/<x>          -> webDir/avatars/<x>
//   /style.css /app.js    -> legacyWebDir (transient)
//   anything else without
//     a file extension    -> webDir/index.html (SPA fallback so a direct
//                             URL like /vault hits the React Router)
//   anything with an
//     extension we don't
//     know about          -> 404 (so a missing asset surfaces clearly)

function isInside(parent: string, child: string): boolean {
  const p = normalize(parent)
  const c = normalize(child)
  return c === p || c.startsWith(p.endsWith('/') ? p : p + '/')
}

function hasFileExtension(path: string): boolean {
  const last = path.split('/').pop() ?? ''
  return /\.[A-Za-z0-9]{1,8}$/.test(last)
}

export async function tryHandleStatic(
  ctx: RouteContext,
  webDir: string,
  legacyWebDir?: string,
): Promise<boolean> {
  const { res, path, method } = ctx
  if (method !== 'GET' && method !== 'HEAD') return false

  if (path === '/' || path === '/index.html') {
    serveFile(res, join(webDir, 'index.html'))
    return true
  }

  if (path.startsWith('/assets/')) {
    const rel = path.replace(/^\/assets\//, '')
    const abs = join(webDir, 'assets', rel)
    if (!isInside(join(webDir, 'assets'), abs)) {
      res.writeHead(400); res.end()
      return true
    }
    if (existsSync(abs)) { serveFile(res, abs); return true }
    res.writeHead(404); res.end()
    return true
  }

  if (path.startsWith('/avatars/')) {
    const rel = path.replace(/^\/avatars\//, '')
    const primary = join(webDir, 'avatars', rel)
    if (existsSync(primary)) { serveFile(res, primary); return true }
    if (legacyWebDir) {
      const fallback = join(legacyWebDir, 'avatars', rel)
      if (existsSync(fallback)) { serveFile(res, fallback); return true }
    }
    res.writeHead(404); res.end()
    return true
  }

  // Legacy bundle paths -- only honored if the legacy tree is still on disk.
  if (legacyWebDir && (path === '/style.css' || path === '/app.js')) {
    const legacyFile = path === '/style.css'
      ? join(legacyWebDir, 'style.css')
      : join(legacyWebDir, 'app.js')
    if (existsSync(legacyFile)) { serveFile(res, legacyFile); return true }
  }

  // SPA fallback: any path that looks like a route (no file extension) goes
  // to index.html so React Router can render it. Paths with an unknown
  // extension fall through to 404 in the caller.
  if (!hasFileExtension(path) && !path.startsWith('/api/')) {
    serveFile(res, join(webDir, 'index.html'))
    return true
  }

  return false
}
