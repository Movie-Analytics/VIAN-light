import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportProject: (p) => ipcRenderer.send('export-project', p),
  exportScreenshots: (p, f) => ipcRenderer.send('export-screenshots', p, f),
  getVideoInfo: (arg) => ipcRenderer.send('get-video-info', arg),
  importProject: (arg, v, z) => ipcRenderer.send('import-project', arg, v, z),
  ipcRenderer: {
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
  },
  loadStore: (arg1, arg2) => ipcRenderer.invoke('load-store', arg1, arg2),
  loadSubtitles: (p) => ipcRenderer.invoke('load-subtitles', p),
  logError: (msg) => ipcRenderer.send('log-error', msg),
  onImportProject: (cb) => ipcRenderer.on('imported-project', (c, ...args) => cb(...args)),
  onJobsUpdate: (cb) => ipcRenderer.on('jobs-update', (c, ...args) => cb(...args)),
  onRedoAction: (callback) => ipcRenderer.on('redo-action', callback),
  onScreenshotGeneration: (cb) =>
    ipcRenderer.on('screenshot-generated', (c, ...args) => cb(...args)),
  onScreenshotsGeneration: (cb) =>
    ipcRenderer.on('screenshots-generated', (c, ...args) => cb(...args)),
  onShotBoundaryDetection: (cb) =>
    ipcRenderer.on('shotboundary-detected', (c, ...args) => cb(...args)),
  onUndoAction: (callback) => ipcRenderer.on('undo-action', callback),
  onVideoInfo: (cb) => ipcRenderer.on('video-info', (c, ...args) => cb(...args)),
  openVideo: () => ipcRenderer.invoke('open-video'),
  runScreenshotGeneration: (v, f, i) => ipcRenderer.send('run-screenshot-generation', v, f, i),
  runScreenshotsGeneration: (v, f, i) => ipcRenderer.send('run-screenshots-generation', v, f, i),
  runShotBoundaryDetection: (arg) => ipcRenderer.send('run-shotboundary-detection', arg),
  saveStore: (arg1, arg2) => ipcRenderer.send('save-store', arg1, arg2),
  terminateJob: (arg) => ipcRenderer.send('terminate-job', arg)
})
