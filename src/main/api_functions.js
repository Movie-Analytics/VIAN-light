const { dialog } = require('electron')
import { parse, stringify } from 'subtitle'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import * as cheerio from 'cheerio'

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

const frameToTimestamp = (frame, fps) => {
  const totalSecs = frame / fps
  const formattedHours = String(Math.floor(totalSecs / 60 / 60)).padStart(2, '0')
  const formattedMinutes = String(Math.floor(totalSecs / 60) % 60).padStart(2, '0')
  const formattedSeconds = String((totalSecs % 60).toFixed(3)).padStart(6, '0')
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}

const generateCSVContent = (undoableStore, mainStore) => {
  return undoableStore.timelines
    .filter((t) => t.type === 'shots')
    .flatMap((timeline) =>
      timeline.data.map((shot) => {
        const start = frameToTimestamp(shot.start, mainStore.fps)
        const end = frameToTimestamp(shot.end, mainStore.fps)
        return `"${timeline.name}"\t${start}\t${end}\t"${shot.annotation || ''}"\n`
      })
    )
    .join('')
}

const generateEAFContent = (undoableStore, mainStore) => {
  let timeorder = '<TIME_ORDER>\n'
  let tiers = ''
  let timeslotid = 1
  let annotationid = 1

  undoableStore.timelines.forEach((t) => {
    if (t.type !== 'shots') return

    tiers += `<TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="${t.name}">\n`

    t.data.forEach((s) => {
      const start = Math.round((s.start / mainStore.fps) * 1000)
      const end = Math.round((s.end / mainStore.fps) * 1000)

      tiers += `
        <ANNOTATION>
            <ALIGNABLE_ANNOTATION ANNOTATION_ID="a${annotationid}"
                TIME_SLOT_REF1="ts${timeslotid}" TIME_SLOT_REF2="ts${timeslotid + 1}">
                <ANNOTATION_VALUE>${s.annotation || ''}</ANNOTATION_VALUE>
            </ALIGNABLE_ANNOTATION>
        </ANNOTATION>
      `
      annotationid++

      timeorder += `<TIME_SLOT TIME_SLOT_ID="ts${timeslotid}" TIME_VALUE="${start}"/>\n`
      timeorder += `<TIME_SLOT TIME_SLOT_ID="ts${timeslotid + 1}" TIME_VALUE="${end}"/>\n`
      timeslotid += 2
    })

    tiers += '</TIER>\n'
  })
  timeorder += '</TIME_ORDER>\n'

  const videoPath = mainStore.video.replace('app://', '')
  return `
    <ANNOTATION_DOCUMENT AUTHOR="" DATE="2025-01-20T14:41:12+01:00"
      FORMAT="3.0" VERSION="3.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">
      <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
        <MEDIA_DESCRIPTOR
          MEDIA_URL="file:///${videoPath}"
          MIME_TYPE="video/mp4" />
        <PROPERTY NAME="lastUsedAnnotationId">0</PROPERTY>
      </HEADER>
      ${timeorder}
      ${tiers}
      <LINGUISTIC_TYPE GRAPHIC_REFERENCES="false"
        LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>
      <CONSTRAINT
        DESCRIPTION="Time subdivision of parent annotation's time interval, no time gaps allowed within this interval" STEREOTYPE="Time_Subdivision"/>
      <CONSTRAINT
        DESCRIPTION="Symbolic subdivision of a parent annotation. Annotations refering to the same parent are ordered" STEREOTYPE="Symbolic_Subdivision"/>
      <CONSTRAINT DESCRIPTION="1-1 association with a parent annotation" STEREOTYPE="Symbolic_Association"/>
      <CONSTRAINT
        DESCRIPTION="Time alignable annotations within the parent annotation's time interval, gaps are allowed" STEREOTYPE="Included_In"/>
    </ANNOTATION_DOCUMENT>
  `
}

export const exportAnnotations = async (_, projectId, csv) => {
  const location = dialog.showSaveDialogSync(null, {
    title: 'Select export location',
    defaultPath: `annotations.${csv ? 'csv' : 'eaf'}`
  })
  if (!location) return

  const [undoableStore, mainStore] = await Promise.all([
    loadStore('undoable', projectId),
    loadStore('main', projectId)
  ])

  const content = csv
    ? generateCSVContent(undoableStore, mainStore)
    : generateEAFContent(undoableStore, mainStore)

  await fs.promises.writeFile(location, content)
}

export const importAnnotations = async (projectId) => {
  const file = selectFile([{ name: 'ELAN import', extensions: ['eaf'] }])
  if (file === null) return null

  const mainStore = await loadStore('main', projectId)

  const content = await fs.promises.readFile(file, 'utf-8')
  const xml = cheerio.load(content)
  const timemap = new Map()
  xml('TIME_SLOT').each((_, element) => {
    timemap.set(
      element.attribs.time_slot_id,
      Math.round((Number(element.attribs.time_value) / 1000) * mainStore.fps)
    )
  })

  const timelines = new Map()
  xml('ALIGNABLE_ANNOTATION').each((_, element) => {
    const timelineId = element.parent.parent.attribs.tier_id
    if (!timelines.has(timelineId)) {
      timelines.set(timelineId, {
        name: timelineId,
        id: crypto.randomUUID(),
        data: [],
        type: 'shots'
      })
    }
    const text = xml(element).find('ANNOTATION_VALUE').text()
    timelines.get(timelineId).data.push({
      start: timemap.get(element.attribs.time_slot_ref1),
      end: timemap.get(element.attribs.time_slot_ref2),
      annotation: text,
      id: crypto.randomUUID()
    })
  })

  return [...timelines.values()]
}

export const cleanUp = () => {
  const worker = CleanUpWorker({
    type: 'module',
    workerData: getDataPath()
  })

  worker.on('error', console.error)
}
