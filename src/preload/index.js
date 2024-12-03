import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openVideoDialog: () => ipcRenderer.invoke('open-video-dialog'),
  runShotBoundaryDetection: (arg) => ipcRenderer.send('run-shotboundary-detection', arg),
  onShotBoundaryDetection: (cb) => ipcRenderer.on('shotboundary-detected', cb),
  loadSubtitles: () => ipcRenderer.invoke('load-subtitles')
})
