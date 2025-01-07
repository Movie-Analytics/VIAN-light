import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openVideoDialog: () => ipcRenderer.invoke('open-video-dialog'),
  runShotBoundaryDetection: (arg) => ipcRenderer.send('run-shotboundary-detection', arg),
  onShotBoundaryDetection: (cb) => ipcRenderer.on('shotboundary-detected', cb),
  runScreenshotsGeneration: (v, f, i) => ipcRenderer.send('run-screenshots-generation', v, f, i),
  onScreenshotsGeneration: (cb) => ipcRenderer.on('screenshots-generated', cb),
  loadSubtitles: () => ipcRenderer.invoke('load-subtitles'),
  onJobsUpdate: (cb) => ipcRenderer.on('jobs-update', cb),
  terminateJob: (arg) => ipcRenderer.send('terminate-job', arg),
  getVideoInfo: (arg) => ipcRenderer.send('get-video-info', arg),
  onVideoInfo: (cb) => ipcRenderer.on('video-info', cb),
  saveStore: (arg1, arg2) => ipcRenderer.send('save-store', arg1, arg2),
  loadStore: (arg1, arg2) => ipcRenderer.invoke('load-store', arg1, arg2)
})
