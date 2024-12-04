import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
const { Worker } = require('node:worker_threads')
import { parse, stringify } from 'subtitle'
import fs from 'fs'

import icon from '../../resources/icon.png?asset'
import ShotBoundaryWorker from './shotboundary_worker?nodeWorker'
import { selectFile } from './dialogs'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
])

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      webSecurity: true
    }
  })
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // using deprecated method until this bug is solved:
  // https://github.com/electron/electron/issues/38749
  // TODO access filter
  protocol.registerFileProtocol('app', (request, callback) => {
    console.log('request', request, callback)
    const filePath = request.url.slice('app://'.length)
    callback(filePath)
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

const jobs = {}
ipcMain.handle('open-video-dialog', () => selectFile([{ name: 'Movies', extensions: ['mp4'] }]))

ipcMain.handle('load-subtitles', () => {
  const file = selectFile([{ name: 'Subtitles', extensions: ['srt'] }])
  if (file === undefined) return undefined

  const vttPath = process.cwd() + '/subtitles.vtt'
  fs.createReadStream(file)
    .pipe(parse())
    .pipe(stringify({ format: 'WebVTT' }))
    .pipe(fs.createWriteStream(vttPath))
  return vttPath
})

ipcMain.on('terminate-job', (channel, jobId) => {
  jobs[jobId].worker.terminate()
  jobs[jobId].status = 'CANCELED'
  sendJobsUpdate(channel)
})

ipcMain.on('run-shotboundary-detection', (channel, path) => {
  const worker = ShotBoundaryWorker({
    type: 'module',
    workerData: path
  })

  const job = {
    creation: Date.now(),
    type: 'shotboundary-detection',
    status: 'RUNNING',
    worker: worker,
    id: Object.keys(jobs).length
  }
  jobs[job.id] = job
  sendJobsUpdate(channel)

  worker.on('error', (e) => {
    job.status = 'ERROR'
    console.log(e)
    sendJobsUpdate(channel)
  })

  worker.on('message', (data) => {
    job.status = 'DONE'
    sendJobsUpdate(channel)
    channel.sender.send('shotboundary-detected', data.e)
  })
})

function sendJobsUpdate(channel) {
  channel.sender.send('jobs-update', JSON.parse(JSON.stringify(jobs)))
}
