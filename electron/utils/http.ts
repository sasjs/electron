import { net } from 'electron'
import log from 'electron-log'

export const ping = async (
  host: string,
  protocol: string,
  hostname: string,
  port: number
) =>
  new Promise(async (resolve, _) => {
    setInterval(function () {
      log.info(`Pinging ${host}`)

      const serverUrl = {
        protocol: `${protocol}:`,
        hostname: hostname,
        port: port
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
            `${host} is up and running at ${
              serverUrl.protocol +
              '//' +
              serverUrl.hostname +
              ':' +
              serverUrl.port
            }.`
          )

          clearInterval(this)

          return resolve(true)
        }
      })

      request.on('error', () => {})
      request.setHeader('Content-Type', 'application/json')
      request.end()
    }, 200)
  })
