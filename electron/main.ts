import { BrowserWindow, ipcMain } from 'electron'
import { fileExists, readFile, createFile } from '@sasjs/utils'
import log from 'electron-log'
import url from 'url'
import { exec, execFile } from 'child_process'
import {
  serverApiEnvPath,
  seedAppFolder,
  seedAppPath,
  seedAppServices,
  getSasPath,
  serverPath,
  preloadPath,
  ping
} from './utils'
import axios from 'axios'

export default class Main {
  static mainWindow: Electron.BrowserWindow
  static application: Electron.App
  static BrowserWindow
  static sasPathKey = 'SAS_PATH='
  static sasjsServicesDeployKey = 'SASJS_SERVICES_DEPLOYED=TRUE'
  static sasjsServerTitle = 'SASjsServer'
  static indexPath: string
  static serverTitle = '@sasjs/server'
  static seedAppTitle = '@sasjs/react-seed-app'

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

  public static startSasJsSeedApp(path?: string) {
    log.info(`Starting ${Main.seedAppTitle}`)
    log.info('Loading @sasjs/react-seed-app index.html')

    // INFO: loading @sasjs/react-seed-app index.html
    Main.mainWindow.loadURL(
      url.format({
        pathname: path || seedAppPath,
        protocol: 'file',
        slashes: true
      })
    )
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

        if (!env.match(new RegExp(Main.sasjsServicesDeployKey))) {
          await Main.deploySasjsServices()
        }
      } else {
        Main.indexPath = getSasPath
      }
    } else {
      log.info(`${Main.serverTitle} .env file does not exist.`)

      Main.indexPath = getSasPath
    }

    Main.mainWindow = new Main.BrowserWindow({
      show: false,
      webPreferences: {
        preload: preloadPath
      }
    })

    Main.mainWindow.maximize()
    Main.mainWindow.show()
    Main.startSasJsSeedApp(Main.indexPath)
    Main.mainWindow.on('closed', Main.onClose)
  }

  static async deploySasjsServices() {
    log.info(`seedAppServices: ${seedAppServices}`)
    let services = await readFile(seedAppServices)

    try {
      services = JSON.parse(services)
    } catch (err) {
      log.error(
        `Error while parsing SASjs services at ${seedAppServices}. Error: ${JSON.stringify(
          err
        )}`
      )
    }

    const response = await axios.post(
      'http://localhost:5000/SASjsApi/drive/deploy',
      services
    )

    if (response.status === 200) {
      log.info(`SASjs services successfully deployed.`)

      let env = await readFile(serverApiEnvPath)
      env += `\n${Main.sasjsServicesDeployKey}`

      await createFile(serverApiEnvPath, env)
    } else {
      log.error(
        `SASjs services deployment failed. @sasjs/server responded: ${JSON.stringify(
          response
        )}`
      )
    }
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
          await Main.deploySasjsServices()

          Main.startSasJsSeedApp()
        }
      })
      .catch((err) => {
        log.error(`Failed to create ${serverApiEnvPath}. Error: ${err}`)
      })
  }
}
