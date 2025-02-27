const { workerData, parentPort } = require('worker_threads')

import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to generate screenshot', workerData)

const reader = new videoReader.VideoReader(workerData.videoPath)
reader.open()
const success = reader.generateScreenshot(workerData.directory, workerData.frame)
let data = null
if (success)
  data = {
    frame: workerData.frame,
    image: `app://${workerData.directory}/${String(workerData.frame).padStart(8, '0')}.jpg`,
    thumbnail: `app://${workerData.directory}/${String(workerData.frame).padStart(8, '0')}_mini.jpg`
  }
parentPort.postMessage({ data })
