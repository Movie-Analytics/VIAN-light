import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportScreenshots: (p, f) => ipcRenderer.send('export-screenshots', p, f),
  getVideoInfo: (arg) => ipcRenderer.send('get-video-info', arg),
  loadStore: (arg1, arg2) => ipcRenderer.invoke('load-store', arg1, arg2),
  loadSubtitles: (p) => ipcRenderer.invoke('load-subtitles', p),
  onJobsUpdate: (cb) => ipcRenderer.on('jobs-update', (c, ...args) => cb(...args)),
  onScreenshotGeneration: (cb) =>
    ipcRenderer.on('screenshot-generated', (c, ...args) => cb(...args)),
  onScreenshotsGeneration: (cb) =>
    ipcRenderer.on('screenshots-generated', (c, ...args) => cb(...args)),
  onShotBoundaryDetection: (cb) =>
    ipcRenderer.on('shotboundary-detected', (c, ...args) => cb(...args)),
  onVideoInfo: (cb) => ipcRenderer.on('video-info', (c, ...args) => cb(...args)),
  openVideo: () => ipcRenderer.invoke('open-video'),
  runScreenshotGeneration: (v, f, i) => ipcRenderer.send('run-screenshot-generation', v, f, i),
  runScreenshotsGeneration: (v, f, i) => ipcRenderer.send('run-screenshots-generation', v, f, i),
  runShotBoundaryDetection: (arg) => ipcRenderer.send('run-shotboundary-detection', arg),
  saveStore: (arg1, arg2) => ipcRenderer.send('save-store', arg1, arg2),
  terminateJob: (arg) => ipcRenderer.send('terminate-job', arg)
})
