import { BrowserWindow, ipcMain } from 'electron'
import { fileExists, readFile, createFile } from '@sasjs/utils'
import log from 'electron-log'
import url from 'url'
import { exec, execFile } from 'child_process'
import {
  serverApiEnvPath,
  seedAppPath,
  getSasPath,
  serverPath,
  preloadPath,
  ping
} from './utils'

export default class Main {
  static mainWindow: Electron.BrowserWindow
  static application: Electron.App
  static BrowserWindow
  static sasPathKey = 'SAS_PATH='
  static sasjsServerTitle = 'SASjsServer'
  static indexPath: string
  static serverTitle = '@sasjs/server'

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') Main.application.quit()
  }

  private static onClose() {
    log.info(`Closing @sasjs/electron`)
    ;(Main.mainWindow as any) = null
  }

  public static startSasjsServer() {
    log.info(`Starting ${Main.serverTitle}`)

    execFile(serverPath, (err) => {
      if (err) log.error(`Failed to start ${Main.serverTitle}. Error: ${err}`)
    })
  }

  static async onReady() {
    log.info(`checking if ${serverApiEnvPath} exists`)

    if (await fileExists(serverApiEnvPath)) {
      log.info(`${Main.serverTitle} .env file exists.`)

      const env = await readFile(serverApiEnvPath)

      let sasPath: RegExpMatchArray | string =
        env.match(new RegExp(`${Main.sasPathKey}.*`)) || ''

      if (sasPath) sasPath = sasPath[0].replace(Main.sasPathKey, '')
      if (sasPath) {
        Main.indexPath = seedAppPath
        Main.startSasjsServer()
      } else {
        Main.indexPath = getSasPath
      }
    } else {
      log.info(`${Main.serverTitle} .env file does not exist.`)

      Main.indexPath = getSasPath
    }

    const startUrl = url.format({
      pathname: Main.indexPath,
      protocol: 'file',
      slashes: true
    })

    Main.mainWindow = new Main.BrowserWindow({
      show: false,
      webPreferences: {
        preload: preloadPath
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

    ipcMain.on('set-sas-path', Main.onSetSasPath)
  }

  static async onSetSasPath(_: any, sasPath: string) {
    log.info(`Received on 'set-sas-path' event.`)
    log.info(`Extracting application source code.`)

    // INFO: extract source code
    exec(
      'cd resources && npx asar extract app.asar appSrc',
      async (err, _, stderr) => {
        if (err) log.error(`extract source code error: ${err}`)
        if (stderr) log.error(`extract source code stderr: ${stderr}`)

        // INFO: create .env file with path to SAS executable
        createFile(serverApiEnvPath, `${Main.sasPathKey}${sasPath}`)
          .then(async () => {
            log.info('Created .env file with path to SAS executable')

            Main.startSasjsServer()

            const isServerUp = await ping(
              Main.serverTitle,
              'http',
              'localhost',
              5000
            )

            if (isServerUp) {
              log.info('Loading @sasjs/react-seed-app index.html')

              // INFO: loading @sasjs/react-seed-app index.html
              Main.mainWindow.loadURL(
                url.format({
                  pathname: seedAppPath,
                  protocol: 'file',
                  slashes: true
                })
              )
            }
          })
          .catch((err) => {
            log.error(`Failed to create ${serverApiEnvPath}. Error: ${err}`)
          })
      }
    )
  }
}
