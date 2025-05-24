// eslint-disable-next-line sort-imports
import { app, BrowserWindow, ipcMain, Menu, protocol, shell } from 'electron'
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
  jobManager,
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
  console.log('Creating window...')
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
  console.log('Window created')

  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    console.log('Loading dev URL:', process.env.ELECTRON_RENDERER_URL)
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    console.log('Loading production file:', join(__dirname, '../renderer/index.html'))
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

  // Create menu and register shortcuts
  import('./menu.js').then(({ createMenu, registerShortcuts }) => {
    const menu = Menu.buildFromTemplate(createMenu())
    Menu.setApplicationMenu(menu)
    registerShortcuts()
  })

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
  // Note: This is a temporary solution until the protocol.registerFileProtocol bug is fixed
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

// Handle application quit
let isQuitting = false
app.on('before-quit', async (event) => {
  // Prevent recursive calls
  if (isQuitting) return

  // Prevent immediate quit
  event.preventDefault()

  // Set quitting flag
  isQuitting = true

  try {
    // Get all running jobs
    const jobs = Array.from(jobManager.jobs.values())
    const runningJobs = jobs.filter((job) => job.status === 'RUNNING')

    if (runningJobs.length > 0) {
      console.log('Waiting for jobs to terminate...')

      // Create an array of cleanup promises
      const cleanupPromises = runningJobs.map(async (job) => {
        try {
          if (job.worker) {
            // First try to cleanup video reader resources
            job.worker.postMessage({ type: 'CLEANUP' })

            // Wait a short moment for cleanup
            await new Promise((resolve) => {
              setTimeout(resolve, 100)
            })

            // Then terminate the job
            jobManager.terminateJob(job.id)
          }
        } catch (err) {
          console.error('Error terminating job:', err)
        }
      })

      // Wait for all cleanup operations to complete
      await Promise.all(cleanupPromises)

      // Give a final moment for resources to be released
      await new Promise((resolve) => {
        setTimeout(resolve, 500)
      })
    }

    // Now quit the application
    app.quit()

    // Force exit in development mode
    if (is.dev) {
      process.exit(0)
    }
  } catch (err) {
    console.error('Error during quit:', err)
    // Force quit even if there was an error
    app.quit()
    if (is.dev) {
      process.exit(1)
    }
  }
})

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
