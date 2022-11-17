const { app, BrowserWindow, ipcMain } = require('electron')
const url = require('url')
const path = require('path')
const sasjsUtils = require('@sasjs/utils')
const { fileExists, readFile, createFile } = sasjsUtils
const shelljs = require('shelljs')
const { exec } = require('child_process')

let mainWindow
let indexPath
const presetPath = path.join(__dirname, 'preload.js')
const sasPathKey = 'SAS_PATH='
const serverApiEnvPath = path.join(__dirname, '..', 'server', 'api', '.env')
const getSasPathHtml = path.join(__dirname, 'getSasPath.html')
const reactAppHtml = path.join(
  __dirname,
  '..',
  'react-seed-app',
  'build',
  'index.html'
)

app.on('ready', async () => {
  if (await fileExists(serverApiEnvPath)) {
    console.log(`🤖[server api env file exists]🤖`)

    const env = await readFile(serverApiEnvPath)

    let sasPath = env.match(new RegExp(`${sasPathKey}.*`))
    if (sasPath) sasPath = sasPath[0].replace(sasPathKey, '')

    if (sasPath) indexPath = reactAppHtml
    else indexPath = getSasPathHtml
  } else {
    indexPath = getSasPathHtml
  }

  const startUrl = url.format({
    pathname: indexPath,
    protocol: 'file',
    slashes: true
  })

  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: presetPath
    }
  })
  mainWindow.maximize()
  mainWindow.show()
  mainWindow.loadURL(startUrl)
  mainWindow.on('closed', () => (mainWindow = null))
})

ipcMain.on('set-sas-path', async (_, path) => {
  await createFile(serverApiEnvPath, `${sasPathKey}${path}`)

  exec('cd server/api && npm run start:prod', (err, stdout, stderr) => {
    console.log(`🤖[err]🤖`, err)
    console.log(`🤖[stderr]🤖`, stderr)
  })

  mainWindow.loadURL(
    url.format({
      pathname: reactAppHtml,
      protocol: 'file',
      slashes: true
    })
  )
})
