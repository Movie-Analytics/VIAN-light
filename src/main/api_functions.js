const { dialog } = require('electron')
import { parse, stringify } from 'subtitle'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import CleanUpWorker from './workers/cleanup_worker?nodeWorker'
import ShotBoundaryWorker from './workers/shotboundary_worker?nodeWorker'
import ScreenshotsGenerationWorker from './workers/screenshots_generation_worker?nodeWorker'
import ScreenshotGenerationWorker from './workers/screenshot_generation_worker?nodeWorker'
import VideoInfoWorker from './workers/videoinfo_worker?nodeWorker'
import ExportScreenshotWorker from './workers/export_screenshots_worker?nodeWorker'

const jobs = {}
function sendJobsUpdate(channel) {
  channel.sender.send('jobs-update', JSON.parse(JSON.stringify(jobs)))
}

export function selectFile(filters) {
  const files = dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: filters
  })
  if (files === undefined) return undefined
  return files[0]
}

export function openVideoDialog() {
  return selectFile([{ name: 'Movies', extensions: ['mp4'] }])
}

export function loadSubtitles(projectId) {
  const file = selectFile([{ name: 'Subtitles', extensions: ['srt'] }])
  if (file === undefined) return null

  const vttPath = path.join(app.getPath('userData'), 'vian-lite', projectId, 'subtitles.vtt')
  fs.createReadStream(file)
    .pipe(parse())
    .pipe(stringify({ format: 'WebVTT' }))
    .pipe(fs.createWriteStream(vttPath))
  return vttPath
}

export function terminateJob(channel, jobId) {
  jobs[jobId].worker.terminate()
  jobs[jobId].status = 'CANCELED'
  sendJobsUpdate(channel)
}

export function loadStore(name, id) {
  const dataPath = path.join(app.getPath('userData'), 'vian-lite')
  let storePath
  if (name === 'meta') {
    storePath = path.join(dataPath, 'meta.json')
  } else {
    storePath = path.join(dataPath, id, name + '.json')
  }
  if (!fs.existsSync(storePath)) return undefined
  const content = fs.readFileSync(storePath, 'utf8')
  return JSON.parse(content)
}

export function saveStore(name, store) {
  const dataPath = path.join(app.getPath('userData'), 'vian-lite')
  fs.mkdirSync(dataPath, { recursive: true })
  console.log('Storage location:', dataPath)

  const data = JSON.stringify(store)
  if (name == 'meta') {
    fs.writeFile(path.join(dataPath, 'meta.json'), data, (err) => {
      if (err) console.error('Error writing:', err)
    })
  } else {
    fs.mkdirSync(path.join(dataPath, store.id), { recursive: true })
    fs.writeFile(path.join(dataPath, store.id, name + '.json'), data, (err) => {
      if (err) console.error('Error writing:', err)
    })
  }
}

export function runShotBoundaryDetection(channel, videoPath) {
  const worker = ShotBoundaryWorker({ workerData: videoPath })
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
    console.log(e)
    job.status = 'ERROR'
    sendJobsUpdate(channel)
  })

  worker.on('message', (data) => {
    job.status = 'DONE'
    sendJobsUpdate(channel)
    channel.sender.send('shotboundary-detected', data.shots)
  })
}

export function runScreenshotsGeneration(channel, videoPath, frames, videoId) {
  const dataPath = path.join(app.getPath('userData'), 'vian-lite', videoId, 'screenshots')
  fs.mkdirSync(dataPath, { recursive: true })
  const worker = ScreenshotsGenerationWorker({
    workerData: { videoPath: videoPath, frames: frames, directory: dataPath }
  })
  const job = {
    creation: Date.now(),
    type: 'screenshots-generation',
    status: 'RUNNING',
    worker: worker,
    id: Object.keys(jobs).length
  }
  jobs[job.id] = job
  sendJobsUpdate(channel)

  worker.on('error', (e) => {
    console.log(e)
    job.status = 'ERROR'
    sendJobsUpdate(channel)
  })

  worker.on('message', (data) => {
    job.status = 'DONE'
    sendJobsUpdate(channel)
    channel.sender.send('screenshots-generated', data.data)
  })
}

export function runScreenshotGeneration(channel, videoPath, frame, videoId) {
  const dataPath = path.join(app.getPath('userData'), 'vian-lite', videoId, 'screenshots')
  fs.mkdirSync(dataPath, { recursive: true })
  const worker = ScreenshotGenerationWorker({
    workerData: { videoPath: videoPath, frame: frame, directory: dataPath }
  })
  const job = {
    creation: Date.now(),
    type: 'screenshot-generation',
    status: 'RUNNING',
    worker: worker,
    id: Object.keys(jobs).length
  }
  jobs[job.id] = job
  sendJobsUpdate(channel)

  worker.on('error', (e) => {
    console.log(e)
    job.status = 'ERROR'
    sendJobsUpdate(channel)
  })

  worker.on('message', (data) => {
    job.status = 'DONE'
    console.log('done')
    sendJobsUpdate(channel)
    channel.sender.send('screenshot-generated', data.data)
  })
}

export function getVideoInfo(channel, videoPath) {
  const worker = VideoInfoWorker({ workerData: videoPath })

  const job = {
    creation: Date.now(),
    type: 'video-info',
    status: 'RUNNING',
    worker: worker,
    id: Object.keys(jobs).length
  }
  jobs[job.id] = job
  sendJobsUpdate(channel)

  worker.on('error', (e) => {
    console.log(e)
    job.status = 'ERROR'
    sendJobsUpdate(channel)
  })

  worker.on('message', (data) => {
    job.status = 'DONE'
    sendJobsUpdate(channel)
    channel.sender.send('video-info', data)
  })
}

export function exportScreenshots(channel, projectId) {
  const location = dialog.showSaveDialogSync(null, {
    title: 'Select export location',
    defaultPath: 'screenshots.zip'
  })
  if (location === '') return
  const storePath = path.join(app.getPath('userData'), 'vian-lite', projectId, 'undoable.json')

  const worker = ExportScreenshotWorker({
    workerData: { storePath: storePath, location: location }
  })

  const job = {
    creation: Date.now(),
    type: 'export-screenshots',
    status: 'RUNNING',
    worker: worker,
    id: Object.keys(jobs).length
  }
  jobs[job.id] = job
  sendJobsUpdate(channel)

  worker.on('error', (e) => {
    console.log(e)
    job.status = 'ERROR'
    sendJobsUpdate(channel)
  })

  worker.on('message', () => {
    job.status = 'DONE'
    sendJobsUpdate(channel)
  })
}

export function cleanUp() {
  const worker = CleanUpWorker({
    type: 'module',
    workerData: path.join(app.getPath('userData'), 'vian-lite')
  })

  worker.on('error', (e) => {
    console.log(e)
  })
}
