import Main from '../main'
import { app, BrowserWindow, ipcMain, net } from 'electron'
import log from 'electron-log'
import * as fileModule from '@sasjs/utils/file'
import {
  serverApiEnvPath,
  getSasPath,
  serverFolder,
  serverPath
} from '../utils'
import * as httpModule from '../utils/http'

let execCommand = ''
let logged = ''
let execFileError = ''

jest.mock('child_process', () => ({
  exec: (command: string, handler: () => {}) => {
    execCommand = execCommand.length ? execCommand + '\n' + command : command

    handler()
  },
  execFile: (exePath: string, handler: (err: string) => {}) => {
    handler(execFileError)
  }
}))

jest.mock('electron', () => ({
  app: {
    getName: jest.fn(),
    getVersion: jest.fn(),
    on: function (event: string, listener: () => {}) {
      this[event] = listener
    },
    emit: async function (event: string) {
      await this[event]()
    },
    quit: jest.fn()
  },
  ipcMain: {
    on: function (event: string, listener: () => {}) {
      this[event] = listener
    },
    emit: async function (event: string) {
      await this[event]()
    }
  },
  BrowserWindow: () => ({
    maximize: jest.fn(),
    show: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn()
  }),
  net: {
    request: () => ({
      on: function (event: string, listener: () => {}) {
        this[event] = listener

        if (event === 'response') this[event]({ statusCode: 200 })
      },
      emit: async function (event: string) {
        await this[event]()
      },
      setHeader: jest.fn(),
      end: jest.fn()
    })
  }
}))

describe('Main', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    })
  })

  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation((value: string) => {
      logged = logged.length ? logged + '\n' + value : value
    })
    jest.spyOn(log, 'error').mockImplementation((value: string) => {
      logged = logged.length ? logged + '\n' + value : value
    })
  })

  afterEach(() => {
    resetExecCommand()
    resetLog()
    jest.clearAllMocks()
  })

  it('should stop @sasjs/server on before-quit event', () => {
    new Main.main(app, BrowserWindow)

    Main.application.emit('before-quit')

    expect(logged).toEqual(`Closing @sasjs/electron`)
  })

  it('should call quit method on window-all-closed event', () => {
    new Main.main(app, BrowserWindow)

    Main.application.emit('window-all-closed')

    expect(app.quit).toHaveBeenCalled()
  })

  it('should start @sasjs/server on ready event when .env file exists with path to SAS executable', async () => {
    jest
      .spyOn(fileModule, 'fileExists')
      .mockImplementation(() => Promise.resolve(true))
    jest
      .spyOn(fileModule, 'readFile')
      .mockImplementation(() => Promise.resolve(`${Main.sasPathKey}.env`))

    new Main.main(app, BrowserWindow)

    await Main.application.emit('ready')

    const expectedLog = [
      `checking if ${serverApiEnvPath} exists`,
      `${Main.serverTitle} .env file exists.`,
      `Starting ${Main.serverTitle}`
    ].join('\n')

    expect(logged).toEqual(expectedLog)
  })

  it('should load getSasPath.html on ready event when .env file exists without path to SAS executable', async () => {
    jest
      .spyOn(fileModule, 'fileExists')
      .mockImplementation(() => Promise.resolve(true))
    jest
      .spyOn(fileModule, 'readFile')
      .mockImplementation(() => Promise.resolve(''))

    new Main.main(app, BrowserWindow)

    await Main.application.emit('ready')

    const expectedLog = [
      `checking if ${serverApiEnvPath} exists`,
      `${Main.serverTitle} .env file exists.`
    ].join('\n')

    expect(logged).toEqual(expectedLog)
    expect(Main.indexPath).toEqual(getSasPath)
  })

  it('should load getSasPath.html on ready event when .env file does not exist', async () => {
    jest
      .spyOn(fileModule, 'fileExists')
      .mockImplementation(() => Promise.resolve(false))

    new Main.main(app, BrowserWindow)

    await Main.application.emit('ready')

    const expectedLog = [
      `checking if ${serverApiEnvPath} exists`,
      `${Main.serverTitle} .env file does not exist.`
    ].join('\n')

    expect(logged).toEqual(expectedLog)
    expect(Main.indexPath).toEqual(getSasPath)
  })

  it('should start @sasjs/server on set-sas-path event', async () => {
    jest.useFakeTimers()
    jest
      .spyOn(fileModule, 'createFile')
      .mockImplementation(() => Promise.resolve())

    new Main.main(app, BrowserWindow)
    Main.mainWindow = new Main.BrowserWindow()

    await ipcMain.emit('set-sas-path')

    jest.advanceTimersByTime(200)

    const expectedLog = [
      `Received on 'set-sas-path' event.`,
      `Extracting application source code.`,
      'Created .env file with path to SAS executable',
      `Starting ${Main.serverTitle}`,
      `Pinging ${Main.serverTitle}`,
      `${Main.serverTitle} is up and running at http://localhost:5000.`,
      'Loading @sasjs/react-seed-app index.html'
    ].join('\n')
    const expectedExecCommands = [
      `cd resources && npx asar extract app.asar appSrc`
    ].join('\n')

    jest.useRealTimers()
    await new Promise((r) => setTimeout(r, 100))

    expect(logged).toEqual(expectedLog)
    expect(execCommand).toEqual(expectedExecCommands)
  })

  it('should log error if env file creation failed', async () => {
    const createFileError = 'Create file error.'
    jest
      .spyOn(fileModule, 'createFile')
      .mockImplementation(() => Promise.reject(createFileError))

    new Main.main(app, BrowserWindow)

    await ipcMain.emit('set-sas-path')

    const expectedLog = [
      `Received on 'set-sas-path' event.`,
      `Extracting application source code.`,
      `Failed to create ${serverApiEnvPath}. Error: ${createFileError}`
    ].join('\n')

    expect(logged).toEqual(expectedLog)
  })

  it('should log error if @sasjs/server failed to start', () => {
    execFileError = 'Exec file error.'

    Main.startSasjsServer()

    const expectedLog = [
      `Starting ${Main.serverTitle}`,
      `Failed to start ${Main.serverTitle}. Error: ${execFileError}`
    ].join('\n')

    expect(logged).toEqual(expectedLog)

    execFileError = ''
  })
})

const resetExecCommand = () => {
  execCommand = ''
}
const resetLog = () => {
  logged = ''
}
