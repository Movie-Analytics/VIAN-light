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
  const job = jobs[jobId]
  if (job.type === 'shotboundary-detection' || job.type === 'screenshots-generation') {
    job.worker.postMessage({ type: 'TERMINATE' })
  } else {
    job.worker.terminate()
    job.status = 'CANCELED'
    sendJobsUpdate(channel)
  }
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
    if (data.status === 'DONE') {
      job.status = 'DONE'
      sendJobsUpdate(channel)
      channel.sender.send('shotboundary-detected', data.shots)
    } else {
      job.status = 'CANCELED'
      sendJobsUpdate(channel)
    }
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
    if (data.status === 'DONE') {
      job.status = 'DONE'
      sendJobsUpdate(channel)
      channel.sender.send('screenshots-generated', data.data)
    } else {
      job.status = 'CANCELED'
      sendJobsUpdate(channel)
    }
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

export function exportScreenshots(channel, projectId, frames) {
  const location = dialog.showSaveDialogSync(null, {
    title: 'Select export location',
    defaultPath: 'screenshots.zip'
  })
  if (location === '') return
  const storePath = path.join(app.getPath('userData'), 'vian-lite', projectId, 'undoable.json')

  const worker = ExportScreenshotWorker({
    workerData: { storePath: storePath, location: location, frames: frames }
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

export function exportAnnotations(channel, projectId, csv) {
  const location = dialog.showSaveDialogSync(null, {
    title: 'Select export location',
    defaultPath: csv? 'annotations.csv' : 'annotations.eaf'
  })
  if (!location) return
  const undoableStorePath = path.join(
    app.getPath('userData'),
    'vian-lite',
    projectId,
    'undoable.json'
  )
  const undoableStore = JSON.parse(fs.readFileSync(undoableStorePath, 'utf8'))
  const mainStorePath = path.join(app.getPath('userData'), 'vian-lite', projectId, 'main.json')
  const mainStore = JSON.parse(fs.readFileSync(mainStorePath, 'utf8'))

  const frameToTimestamp = (f) => {
    const totalSecs = f / mainStore.fps
    const formattedHours = String(Math.floor(totalSecs / 60 / 60)).padStart(2, '0')
    const formattedMinutes = String(Math.floor(totalSecs / 60) % 60).padStart(2, '0')
    const formattedSeconds = String((totalSecs % 60).toFixed(3)).padStart(6, '0')
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
  }
  let content = ''

  if (csv) {
    undoableStore.timelines.forEach((t) => {
      if (t.type !== 'shots') return
      t.data.forEach((s) => {
        const start = frameToTimestamp(s.start)
        const end = frameToTimestamp(s.end)
        content += `"${t.name}"\t${start}\t${end}\t"${s.annotation || ''}"\n`
      })
    })

  } else {
    // elan
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

    content = `
      <ANNOTATION_DOCUMENT AUTHOR="" DATE="2025-01-20T14:41:12+01:00"
        FORMAT="3.0" VERSION="3.0"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">
        <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
          <MEDIA_DESCRIPTOR
            MEDIA_URL="file:///home/entrup/Downloads/Sintel.mp4"
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
  fs.writeFileSync(location, content, (err) => {
    if (err) {
      console.error(err)
    }
  })
}

export function importAnnotations(projectId) {
  const file = selectFile([{ name: 'ELAN import', extensions: ['eaf'] }])
  if (file === undefined) return null

  const mainStorePath = path.join(app.getPath('userData'), 'vian-lite', projectId, 'main.json')
  const mainStore = JSON.parse(fs.readFileSync(mainStorePath, 'utf8'))

  let content = fs.readFileSync(file, 'utf-8')
  const xml = cheerio.load(content)
  const timemap = new Map()
  xml('TIME_SLOT').each((i, element) => {
    timemap.set(
      element.attribs.time_slot_id,
      Math.round((Number(element.attribs.time_value) / 1000) * mainStore.fps)
    )
  })

  const timelines = new Map()
  xml('ALIGNABLE_ANNOTATION').each((i, element) => {
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

export function cleanUp() {
  const worker = CleanUpWorker({
    type: 'module',
    workerData: path.join(app.getPath('userData'), 'vian-lite')
  })

  worker.on('error', (e) => {
    console.log(e)
  })
}
