import { BrowserWindow, app, ipcMain, protocol, shell, Menu, globalShortcut } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { join } from 'path'

// Set application name immediately
app.setName('VIAN-light')

import {
  cleanUp,
  exportProject,
  exportScreenshots,
  getVideoInfo,
  importProject,
  loadStore,
  loadSubtitles,
  logError,
  openVideoDialog,
  runScreenshotGeneration,
  runScreenshotsGeneration,
  runShotBoundaryDetection,
  saveStore,
  terminateJob
} from './api_functions'
import icon from '../../resources/icon.png?asset'

protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      bypassCSP: true,
      secure: true,
      stream: true,
      supportFetchAPI: true
    },
    scheme: 'app'
  }
])

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 670,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      webSecurity: true
    },
    width: 900,
    ...(process.platform === 'linux' ? { icon } : {})
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
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.vian-light')
  
  // Set application name
  app.setName('VIAN-light')
  
  // Register global shortcuts
  globalShortcut.register('Space', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('toggle-playback')
  })
  
  globalShortcut.register('Right', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('frame-forward')
  })
  
  globalShortcut.register('Left', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('frame-backward')
  })
  
  // JKL system for playback control
  globalShortcut.register('j', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('playback-backward')
  })
  
  globalShortcut.register('k', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('stop-playback')
  })
  
  globalShortcut.register('l', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('playback-forward')
  })

  // A/S for segment navigation
  globalShortcut.register('a', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('segment-previous')
  })
  
  globalShortcut.register('s', () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('segment-next')
  })

  // Create minimal macOS menu
  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'VIAN-light',
        submenu: [
          { role: 'about', label: `About ${app.getName()}` },
          { type: 'separator' },
          { role: 'services', label: 'Services' },
          { type: 'separator' },
          { role: 'hide', label: `Hide ${app.getName()}` },
          { role: 'hideOthers', label: 'Hide Others' },
          { role: 'unhide', label: 'Show All' },
          { type: 'separator' },
          { role: 'quit', label: `Quit ${app.getName()}` }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            click: () => {
              BrowserWindow.getFocusedWindow()?.webContents.send('undo-action')
            }
          },
          {
            label: 'Redo',
            accelerator: 'CmdOrCtrl+Shift+Z',
            click: () => {
              BrowserWindow.getFocusedWindow()?.webContents.send('redo-action')
            }
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize', label: 'Minimize' },
          { role: 'zoom', label: 'Zoom' },
          { type: 'separator' },
          { role: 'front', label: 'Bring All to Front' }
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Using deprecated method until this bug is solved:
  // https://github.com/electron/electron/issues/38749
  // TODO: access filter
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
// TODO platform handling MAC 

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

process.on('uncaughtException', (error) => {
  logError(`Uncaught Exception: ${error.stack || error.message}`)
})
process.on('unhandledRejection', (reason) => {
  logError(`Unhandled Promise Rejection: ${reason}`)
})

ipcMain.handle('open-video', () => openVideoDialog())
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
ipcMain.on('export-project', (channel, projectId) => exportProject(channel, projectId))
ipcMain.on('import-project', (channel, videoFile, zipFile) =>
  importProject(channel, videoFile, zipFile)
)
ipcMain.on('log-error', (_, msg) => {
  logError(`Renderer Process Error: ${msg}`)
})

cleanUp()
