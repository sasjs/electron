import { BrowserWindow, net, ipcMain } from 'electron'
import path from 'path'
import { fileExists, readFile, createFile } from '@sasjs/utils'
import log from 'electron-log'
import url from 'url'
import { exec } from 'child_process'

export default class Main {
  static mainWindow: Electron.BrowserWindow
  static application: Electron.App
  static BrowserWindow
  static serverApiEnvPath = path.join(__dirname, '..', '..', '..', '..', '.env')
  static sasPathKey = 'SAS_PATH='
  static sasjsServerTitle = 'SASjsServer'
  static indexPath: string
  static seedAppPath = path.join(
    __dirname,
    '..',
    'react-seed-app',
    'build',
    'index.html'
  )
  static getSasPath = path.join(__dirname, 'getSasPath.html')
  static serverFolder = path.join('resources', 'appSrc', 'build', 'server')
  static serverTitle = '@sasjs/server'

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') Main.application.quit()
  }

  private static onClose() {
    ;(Main.mainWindow as any) = null

    Main.stopSasjsServer()
  }

  private static startSasjsServer() {
    log.info(`Starting ${Main.serverTitle}`)
    exec(
      `start /min "${Main.sasjsServerTitle}" node ${path.join(
        this.serverFolder,
        'src',
        'server.js'
      )}`,
      (err, _, stderr) => {
        if (err) log.error(`Failed to start ${Main.serverTitle}. Error: `, err)
        if (stderr)
          log.error(`Failed to start ${Main.serverTitle}. Error: `, stderr)
      }
    )
  }

  private static stopSasjsServer() {
    log.info(`Stopping ${Main.serverTitle}`)

    exec(
      `taskkill /FI "WindowTitle eq ${Main.sasjsServerTitle}*" /T /F`,
      (err, _, stderr) => {
        if (err) log.error(`Failed to stop ${Main.serverTitle}. Error: `, err)
        if (stderr)
          log.error(`Failed to stop ${Main.serverTitle}. Error: `, stderr)
      }
    )
  }

  static async onReady() {
    log.info(`checking if ${Main.serverApiEnvPath} exists`)

    if (await fileExists(Main.serverApiEnvPath)) {
      log.info(`${Main.serverTitle} .env file exists.`)

      Main.startSasjsServer()

      const env = await readFile(Main.serverApiEnvPath)

      let sasPath: RegExpMatchArray | string =
        env.match(new RegExp(`${Main.sasPathKey}.*`)) || ''
      if (sasPath) sasPath = sasPath[0].replace(Main.sasPathKey, '')
      if (sasPath) Main.indexPath = Main.seedAppPath
      else Main.indexPath = Main.getSasPath
    } else {
      log.info(`${Main.serverTitle} .env file does not exist.`)

      Main.indexPath = Main.getSasPath
    }

    const startUrl = url.format({
      pathname: Main.indexPath,
      protocol: 'file',
      slashes: true
    })

    Main.mainWindow = new Main.BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    })
    Main.mainWindow.maximize()
    Main.mainWindow.show()
    Main.mainWindow.loadURL(startUrl)
    Main.mainWindow.on('closed', Main.onClose)
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow) {
    Main.BrowserWindow = browserWindow
    Main.application = app
    Main.application.on('ready', Main.onReady)
    Main.application.on('window-all-closed', Main.onWindowAllClosed)
    Main.application.on('before-quit', Main.onClose)
    Main.application.on('before-quit', Main.onClose)

    ipcMain.on('set-sas-path', Main.onSetSasPath)
  }

  static async onSetSasPath(_: any, sasPath: string) {
    log.info(`Received on 'set-sas-path' event.`)
    log.info('Extracting application source code.')

    // INFO: extract source code
    exec(
      'cd resources && npx asar extract app.asar appSrc',
      (err, _, stderr) => {
        if (err) log.error(`extract source code error: `, err)
        if (stderr) log.error(`extract source code stderr: `, stderr)

        log.info(`Preparing node_modules for ${Main.serverTitle}`)

        // INFO: rename node_modules folder
        exec(
          `cd ${Main.serverFolder} && move node_modules_tmp node_modules`,
          (err, _, stderr) => {
            if (err) log.error('rename node_modules error: ', err)
            if (stderr) log.error('rename node_modules stderr: ', stderr)

            // INFO: create .env file with path to SAS executable
            createFile(Main.serverApiEnvPath, `${Main.sasPathKey}${sasPath}`)
              .then(() => {
                log.info('Created .env file with path to SAS executable')

                Main.startSasjsServer()

                const pingInterval = setInterval(() => {
                  pingServer()
                }, 200)

                const pingServer = () => {
                  log.info(`Pinging ${Main.serverTitle}`)

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
                        `${Main.serverTitle} is up and running at ${
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
                      Main.mainWindow.loadURL(
                        url.format({
                          pathname: Main.seedAppPath,
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
                log.error(
                  `Failed to create ${Main.serverApiEnvPath}. Error: `,
                  err
                )
              })
          }
        )
      }
    )
  }
}
