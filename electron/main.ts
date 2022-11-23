const { app, BrowserWindow, ipcMain } = require('electron')
const url = require('url')
const path = require('path')
const sasjsUtils = require('@sasjs/utils')
const { fileExists, readFile, createFile } = sasjsUtils
const { exec } = require('child_process')
const net = require('electron').net
const log = require('electron-log')

let mainWindow
let indexPath
const presetPath = path.join(__dirname, 'preload.js')
const sasPathKey = 'SAS_PATH='
const serverApiEnvPath = path.join(__dirname, '..', '..', '..', '..', '.env')
const getSasPathHtml = path.join(__dirname, 'getSasPath.html')
const reactAppHtml = path.join(
  __dirname,
  '..',
  'react-seed-app',
  'build',
  'index.html'
)
const sasjsServerTitle = 'SASjsServer'

const startSasjsServer = () => {
  exec(
    `start /min "${sasjsServerTitle}" node resources\\appSrc\\build\\server\\src\\server.js`,
    (err, _, stderr) => {
      if (err) log.error(`Failed to start @sasjs/server. Error: `, err)
      if (stderr) log.error(`Failed to start @sasjs/server. Error: `, stderr)
    }
  )
}

const stopSasjsServer = () => {
  log.info('Stopping @sasjs/server')

  exec(
    `taskkill /FI "WindowTitle eq ${sasjsServerTitle}*" /T /F`,
    (err, _, stderr) => {
      if (err) log.error(`Failed to stop @sasjs/server. Error: `, err)
      if (stderr) log.error(`Failed to stop @sasjs/server. Error: `, stderr)
    }
  )
}

app.on('ready', async () => {
  if (await fileExists(serverApiEnvPath)) {
    log.info('@sasjs/server .env file exists.')

    startSasjsServer()

    const env = await readFile(serverApiEnvPath)

    let sasPath = env.match(new RegExp(`${sasPathKey}.*`))
    if (sasPath) sasPath = sasPath[0].replace(sasPathKey, '')

    if (sasPath) indexPath = reactAppHtml
    else indexPath = getSasPathHtml
  } else {
    log.info('@sasjs/server .env file does not exist.')

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
  mainWindow.on('closed', () => {
    mainWindow = null

    stopSasjsServer()
  })
})

ipcMain.on('set-sas-path', async (_, path) => {
  log.info(`Received on 'set-sas-path' event.`)
  log.info('Extracting application source code.')

  // INFO: extract source code
  exec('cd resources && npx asar extract app.asar appSrc', (err, _, stderr) => {
    if (err) log.error(`extract source code error: `, err)
    if (stderr) log.error(`extract source code stderr: `, stderr)

    log.info('Preparing node_modules for @sasjs/server ')

    // INFO: rename node_modules folder
    exec(
      'cd resources\\appSrc\\build\\server && move node_modules_tmp node_modules',
      (err, _, stderr) => {
        if (err) log.error('rename node_modules error: ', err)
        if (stderr) log.error('rename node_modules stderr: ', stderr)

        // INFO: create .env file with path to SAS executable
        createFile(serverApiEnvPath, `${sasPathKey}${path}`)
          .then(() => {
            log.info('Created .env file with path to SAS executable')
            log.info('Starting @sasjs/server')

            startSasjsServer()

            const pingInterval = setInterval(() => {
              pingServer()
            }, 200)

            const pingServer = () => {
              log.info('Pinging @sasjs/server')

              const serverUrl = {
                protocol: 'http:',
                hostname: 'localhost',
                port: 5000
              }

              const request = net.request({
                method: 'GET',
                protocol: serverUrl.protocol,
                hostname: serverUrl.hostname,
                port: serverUrl.port,
                path: '/'
              })

              request.on('response', (response) => {
                if (response.statusCode === 200) {
                  log.info(
                    `@sasjs/server is up and running at ${
                      serverUrl.protocol +
                      '//' +
                      serverUrl.hostname +
                      ':' +
                      serverUrl.port
                    }.`
                  )

                  clearInterval(pingInterval)

                  log.info('Loading @sasjs/react-seed-app index.html')

                  // INFO: loading @sasjs/react-seed-app index.html
                  mainWindow.loadURL(
                    url.format({
                      pathname: reactAppHtml,
                      protocol: 'file',
                      slashes: true
                    })
                  )
                }
              })

              request.on('error', () => {})
              request.setHeader('Content-Type', 'application/json')
              request.end()
            }
          })
          .catch((err) => {
            log.error(`Failed to create ${serverApiEnvPath}. Error: `, err)
          })
      }
    )
  })
})

app.on('before-quit', () => {
  log.info(`Received 'before-quit' event.`)

  stopSasjsServer()
})
