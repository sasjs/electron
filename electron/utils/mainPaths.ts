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
export const seedAppFolder = path.join(__dirname, '..', '..', 'react-seed-app')
export const seedAppPath = path.join(seedAppFolder, 'build', 'index.html')
export const seedAppServices = path.join(
  seedAppFolder,
  'sasjsbuild',
  'electron.json'
)
export const getSasPath = path.join(__dirname, '..', 'getSasPath.html')
export const serverFolder = path.join('resources', 'app', 'build', 'server')
export const serverPath = path.join(serverFolder, 'api-win.exe')
export const preloadPath = path.join(__dirname, '..', 'preload.js')
