/* eslint-disable no-promise-executor-return */
// FIXME: remove eslint-disable no-promise-executor-return
import { parse, stringify } from 'subtitle'
const { dialog } = require('electron')
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import cleanUpWorker from './workers/cleanup_worker?nodeWorker'
import exportProjectWorker from './workers/export_project_worker?nodeWorker'
import exportScreenshotWorker from './workers/export_screenshots_worker?nodeWorker'
import importProjectWorker from './workers/import_project_worker?nodeWorker'
import screenshotGenerationWorker from './workers/screenshot_generation_worker?nodeWorker'
import screenshotsGenerationWorker from './workers/screenshots_generation_worker?nodeWorker'
import shotBoundaryWorker from './workers/shotboundary_worker?nodeWorker'
import videoInfoWorker from './workers/videoinfo_worker?nodeWorker'

const DATA_DIR = 'vian-light'

const getDataPath = (projectId = '') => path.join(app.getPath('userData'), DATA_DIR, projectId)

const getStorePath = (projectId, name) => path.join(getDataPath(projectId), `${name}.json`)

export const logError = (msg) => {
  const logPath = getDataPath('error.log')
  const logMessage = `[${new Date().toISOString()}]: ${msg}\n`
  fs.appendFileSync(logPath, logMessage, 'utf8')
}

class JobManager {
  constructor() {
    this.jobs = new Map()
  }

  createJob(type, worker) {
    const job = {
      creation: Date.now(),
      id: this.jobs.size,
      status: 'RUNNING',
      type,
      worker
    }
    this.jobs.set(job.id, job)
    return job
  }

  updateJobStatus(channel, jobId, status) {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = status
      this.sendJobsUpdate(channel)
    } else {
      console.warn('Job not found. Status cannot be updated')
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
      logError(`Error in worker: ${error.stack || error.message}`)
      this.updateJobStatus(channel, job.id, 'ERROR')
    })

    this.sendJobsUpdate(channel)
    return job
  }

  async cancelAllOperations() {
    const jobs = Array.from(this.jobs.values())
    const runningJobs = jobs.filter((job) => job.status === 'RUNNING')

    if (runningJobs.length > 0) {
      const cleanupPromises = runningJobs.map((job) => {
        try {
          if (job.worker) {
            const promise = new Promise((resolve) => {
              const cleanup = (data) => {
                if (data.status === 'CLEANED') {
                  job.worker.off('message', cleanup)
                  this.terminateJob(job.id)
                  resolve()
                }
              }
              job.worker.on('message', cleanup)
              job.worker.postMessage({ type: 'CLEANUP' })
              setTimeout(() => {
                job.worker.off('message', cleanup)
                this.terminateJob(job.id)
                resolve()
              }, 1000)
            })
            return promise
          }
          return Promise.resolve()
        } catch (err) {
          console.error('Error terminating job:', err)
          return Promise.resolve()
        }
      })

      await Promise.all(cleanupPromises)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return true
  }
}

const jobManager = new JobManager()

// Export jobManager instance
export { jobManager }

// exported functions ↓

export const selectFile = (filters) => {
  const result = dialog.showOpenDialogSync({
    filters,
    properties: ['openFile']
  })
  return result?.[0] || null
}

export const openVideoDialog = () => {
  const video = selectFile([{ extensions: ['mp4'], name: 'Videos' }])
  if (!video) return null
  return {
    location: `app://${video}`,
    name: path.basename(video)
  }
}

export const loadSubtitles = (projectId) => {
  const file = selectFile([{ extensions: ['srt'], name: 'Subtitles' }])
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
  const worker = shotBoundaryWorker({ workerData: videoPath.replace('app://', '') })
  const job = jobManager.createWorkerJob(channel, 'shotboundary-detection', worker)

  worker.on('message', (data) => {
    if (data.status === 'DONE') {
      jobManager.updateJobStatus(channel, job.id, 'DONE')
      channel.sender.send('shotboundary-detected', data.shots)
    } else {
      jobManager.updateJobStatus(channel, job.id, 'ERROR')
      if (data.error) {
        logError(`Shot detection error: ${data.error}`)
      }
    }
  })

  worker.on('error', (error) => {
    console.error('Shot detection worker error:', error)
    logError(`Shot detection worker error: ${error.stack || error.message}`)
    jobManager.updateJobStatus(channel, job.id, 'ERROR')
  })
}

export const runScreenshotsGeneration = (channel, videoPath, frames, videoId) => {
  const dataPath = path.join(getDataPath(videoId), 'screenshots')
  fs.mkdirSync(dataPath, { recursive: true })

  const worker = screenshotsGenerationWorker({
    workerData: { directory: dataPath, frames, videoPath: videoPath.replace('app://', '') }
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

  const worker = screenshotGenerationWorker({
    workerData: { directory: dataPath, frame, videoPath: videoPath.replace('app://', '') }
  })
  const job = jobManager.createWorkerJob(channel, 'screenshot-generation', worker)

  worker.on('message', (data) => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
    channel.sender.send('screenshot-generated', data.data)
  })
}

export const getVideoInfo = (channel, videoPath) => {
  const worker = videoInfoWorker({ workerData: videoPath.replace('app://', '') })
  const job = jobManager.createWorkerJob(channel, 'video-info', worker)

  worker.on('message', (data) => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
    channel.sender.send('video-info', data)
  })
}

export const exportScreenshots = (channel, projectId, frames) => {
  const location = dialog.showSaveDialogSync(null, {
    defaultPath: 'screenshots.zip',
    title: 'Select export location'
  })
  if (location === '') return

  const worker = exportScreenshotWorker({
    workerData: { frames, location, storePath: getDataPath(projectId) }
  })
  const job = jobManager.createWorkerJob(channel, 'export-screenshots', worker)

  worker.on('message', () => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
  })
}

export const exportProject = (channel, projectId) => {
  const location = dialog.showSaveDialogSync(null, {
    defaultPath: 'vian_project.zip',
    title: 'Select export location'
  })
  if (location === '') return
  const projectPath = getDataPath(projectId)

  const worker = exportProjectWorker({ workerData: { location, projectPath } })
  const job = jobManager.createWorkerJob(channel, 'export-project', worker)

  worker.on('message', () => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
  })
}

export const importProject = (channel, videoFile, zipFile) => {
  const dataPath = path.join(app.getPath('userData'), DATA_DIR)
  const worker = importProjectWorker({ workerData: { dataPath, videoFile, zipFile } })
  const job = jobManager.createWorkerJob(channel, 'import-project', worker)

  worker.on('message', (data) => {
    jobManager.updateJobStatus(channel, job.id, 'DONE')
    channel.sender.send('imported-project', data)
  })
}

export const cleanUp = () => {
  const worker = cleanUpWorker({
    type: 'module',
    workerData: getDataPath()
  })

  worker.on('error', console.error)
}
