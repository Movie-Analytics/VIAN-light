const { workerData, parentPort } = require('worker_threads')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

import { generateThumbnails } from './ffmpeg'
import { shots } from './shotboundary'

async function shotBoundaryDetection(videoPath, tmpPath) {
  await generateThumbnails(videoPath, tmpPath)
  return await shots(tmpPath)
}

if (workerData !== null && workerData !== undefined) {
  console.log('Running shotboundary detection for', workerData)

  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-lite-'))
  console.log('Temporarily frames directory:', tmpPath)

  shotBoundaryDetection(workerData, tmpPath).then((e) => {
    parentPort.postMessage({ e })
    fs.rmSync(tmpPath, { recursive: true, force: true })
  })
}
