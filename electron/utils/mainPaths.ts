import path from 'path'

export const serverApiEnvPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '.env'
)
export const seedAppPath = path.join(
  __dirname,
  '..',
  '..',
  'react-seed-app',
  'build',
  'index.html'
)
export const getSasPath = path.join(__dirname, '..', 'getSasPath.html')
export const serverFolder = path.join('resources', 'appSrc', 'build', 'server')
export const serverPath = path.join(serverFolder, 'api-win.exe')
export const preloadPath = path.join(__dirname, '..', 'preload.js')
