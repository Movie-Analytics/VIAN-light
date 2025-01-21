import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openVideoDialog: () => ipcRenderer.invoke('open-video-dialog'),
  runShotBoundaryDetection: (arg) => ipcRenderer.send('run-shotboundary-detection', arg),
  onShotBoundaryDetection: (cb) => ipcRenderer.on('shotboundary-detected', cb),
  runScreenshotsGeneration: (v, f, i) => ipcRenderer.send('run-screenshots-generation', v, f, i),
  onScreenshotsGeneration: (cb) => ipcRenderer.on('screenshots-generated', cb),
  runScreenshotGeneration: (v, f, i) => ipcRenderer.send('run-screenshot-generation', v, f, i),
  onScreenshotGeneration: (cb) => ipcRenderer.on('screenshot-generated', cb),
  loadSubtitles: (p) => ipcRenderer.invoke('load-subtitles', p),
  importAnnotations: (p) => ipcRenderer.invoke('import-annotations', p),
  onJobsUpdate: (cb) => ipcRenderer.on('jobs-update', cb),
  terminateJob: (arg) => ipcRenderer.send('terminate-job', arg),
  getVideoInfo: (arg) => ipcRenderer.send('get-video-info', arg),
  onVideoInfo: (cb) => ipcRenderer.on('video-info', cb),
  saveStore: (arg1, arg2) => ipcRenderer.send('save-store', arg1, arg2),
  loadStore: (arg1, arg2) => ipcRenderer.invoke('load-store', arg1, arg2),
  exportScreenshots: (p, f) => ipcRenderer.send('export-screenshots', p, f),
  exportAnnotations: (p, csv) => ipcRenderer.send('export-annotations', p, csv)
})
