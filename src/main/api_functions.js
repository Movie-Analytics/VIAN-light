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

const DATA_DIR = 'vian-lite'

const getDataPath = (projectId = '') => path.join(app.getPath('userData'), DATA_DIR, projectId)

const getStorePath = (projectId, name) => path.join(getDataPath(projectId), `${name}.json`)

class JobManager {
  constructor() {
    this.jobs = new Map()
  }

  createJob(type, worker) {
    const job = {
      id: this.jobs.size,
      creation: Date.now(),
      type: type,
      status: 'RUNNING',
      worker: worker
    }
    this.jobs.set(job.id, job)
    return job
  }

  updateJobStatus(channel, jobId, status) {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = status
      this.sendJobsUpdate(channel)
    }
  }

  terminateJob(jobId) {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (['shotboundary-detection', 'screenshots-generation'].includes(job.type)) {
      job.worker.postMessage({ type: 'TERMINATE' })
    } else {
      job.worker.terminate()
      job.status = 'CANCELED'
    }
    return true
  }

  sendJobsUpdate(channel) {
    channel.sender.send('jobs-update', JSON.parse(JSON.stringify(Array.from(this.jobs.values()))))
  }

  createWorkerJob(channel, type, worker) {
    const job = this.createJob(type, worker)

    worker.on('error', (error) => {
      console.error(`Worker error in ${type}:`, error)
      jobManager.updateJobStatus(job.id, 'ERROR')
      this.sendJobsUpdate(channel)
    })

    this.sendJobsUpdate(channel)
    return job
  }
}

const jobManager = new JobManager()

// exported functions ↓

export const selectFile = (filters) => {
  const result = dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: filters
  })
  return result?.[0] || null
}

export const openVideoDialog = () => {
  const video = selectFile([{ name: 'Videos', extensions: ['mp4'] }])
  if (!video) return null
  return {
    location: `app://${video}`,
    name: path.basename(video)
  }
}

export const loadSubtitles = (projectId) => {
  const file = selectFile([{ name: 'Subtitles', extensions: ['srt'] }])
  if (!file) return null

  const vttPath = path.join(getDataPath(projectId), 'subtitles.vtt')
  fs.createReadStream(file)
    .pipe(parse())
    .pipe(stringify({ format: 'WebVTT' }))
    .pipe(fs.createWriteStream(vttPath))
  return 'app://' + vttPath
}

export const terminateJob = (channel, jobId) => {
  jobManager.terminateJob(jobId)
  jobManager.sendJobsUpdate(channel)
}

export const loadStore = (name, id) => {
  const storePath = id ? getStorePath(id, name) : getStorePath('', 'meta')
  try {
    const content = fs.readFileSync(storePath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export const saveStore = (name, store) => {
  const dataPath = getDataPath(store.id || '')
  fs.mkdirSync(dataPath, { recursive: true })

  const storePath = name === 'meta' ? getStorePath('', 'meta') : getStorePath(store.id, name)
  fs.writeFileSync(storePath, JSON.stringify(store))
}

export const runShotBoundaryDetection = (channel, videoPath) => {
  const worker = ShotBoundaryWorker({ workerData: videoPath.replace('app://', '') })
  const job = jobManager.createWorkerJob(channel, 'shotboundary-detection', worker)

  worker.on('message', (data) => {
    if (data.status === 'DONE') {
      jobManager.updateJobStatus(channel, job.id, 'DONE')
      channel.sender.send('shotboundary-detected', data.shots)
    } else {
      jobManager.updateJobStatus(channel, job.id, 'CANCELED')
    }
  })
}

export const runScreenshotsGeneration = (channel, videoPath, frames, videoId) => {
  const dataPath = path.join(getDataPath(videoId), 'screenshots')
  fs.mkdirSync(dataPath, { recursive: true })

  const worker = ScreenshotsGenerationWorker({
    workerData: { videoPath: videoPath.replace('app://', ''), frames: frames, directory: dataPath }
  })
  const job = jobManager.createWorkerJob(channel, 'screenshots-generation', worker)

  worker.on('message', (data) => {
    if (data.status === 'DONE') {
      jobManager.updateJobStatus(channel, job.id, 'DONE')
      channel.sender.send('screenshots-generated', data.data)
    } else {
      jobManager.updateJobStatus(channel, job.id, 'CANCELED')
    }
  })
}

export const runScreenshotGeneration = (channel, videoPath, frame, videoId) => {
  const dataPath = path.join(getDataPath(videoId), 'screenshots')
  fs.mkdirSync(dataPath, { recursive: true })

  const worker = ScreenshotGenerationWorker({
    workerData: { videoPath: videoPath.replace('app://', ''), frame: frame, directory: dataPath }
  })
  const job = jobManager.createWorkerJob(channel, 'screenshot-generation', worker)

  worker.on('message', (data) => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
    channel.sender.send('screenshot-generated', data.data)
  })
}

export const getVideoInfo = (channel, videoPath) => {
  const worker = VideoInfoWorker({ workerData: videoPath.replace('app://', '') })
  const job = jobManager.createWorkerJob(channel, 'video-info', worker)

  worker.on('message', (data) => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
    channel.sender.send('video-info', data)
  })
}

export const exportScreenshots = (channel, projectId, frames) => {
  const location = dialog.showSaveDialogSync(null, {
    title: 'Select export location',
    defaultPath: 'screenshots.zip'
  })
  if (location === '') return
  const storePath = path.join(getDataPath(projectId), 'undoable.json')

  const worker = ExportScreenshotWorker({
    workerData: { storePath: storePath, location: location, frames: frames }
  })
  const job = jobManager.createWorkerJob(channel, 'export-screenshots', worker)

  worker.on('message', () => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
  })
}

export const cleanUp = () => {
  const worker = CleanUpWorker({
    type: 'module',
    workerData: getDataPath()
  })

  worker.on('error', console.error)
}
