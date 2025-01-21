import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'
import {
  cleanUp,
  exportAnnotations,
  exportScreenshots,
  getVideoInfo,
  importAnnotations,
  loadStore,
  loadSubtitles,
  openVideoDialog,
  runScreenshotsGeneration,
  runScreenshotGeneration,
  runShotBoundaryDetection,
  saveStore,
  terminateJob
} from './api_functions'

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

ipcMain.handle('open-video-dialog', () => openVideoDialog())
ipcMain.handle('load-subtitles', (_event, projectId) => loadSubtitles(projectId))
ipcMain.on('terminate-job', (channel, jobId) => terminateJob(channel, jobId))
ipcMain.handle('load-store', (_event, name, id) => loadStore(name, id))
ipcMain.on('save-store', (_channel, name, store) => saveStore(name, store))
ipcMain.on('run-shotboundary-detection', (channel, path) => runShotBoundaryDetection(channel, path))
ipcMain.on('run-screenshots-generation', (channel, path, frames, videoId) =>
  runScreenshotsGeneration(channel, path, frames, videoId)
)
ipcMain.on('run-screenshot-generation', (channel, path, frame, videoId) =>
  runScreenshotGeneration(channel, path, frame, videoId)
)
ipcMain.on('get-video-info', (channel, path) => getVideoInfo(channel, path))
ipcMain.on('export-screenshots', (channel, projectId, frames) =>
  exportScreenshots(channel, projectId, frames)
)
ipcMain.on('export-annotations', (channel, projectId, csv) =>
  exportAnnotations(channel, projectId, csv)
)
ipcMain.handle('import-annotations', (_event, projectId) => importAnnotations(projectId))

cleanUp()
