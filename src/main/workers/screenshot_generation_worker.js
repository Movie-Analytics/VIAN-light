const { workerData, parentPort } = require('worker_threads')
const path = require('path')

import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to generate screenshot', workerData)

const reader = new videoReader.VideoReader(workerData.videoPath)
reader.open()
const success = reader.generateScreenshot(workerData.directory, workerData.frame)
let data = null
if (success) {
  const basepath = path.join(workerData.directory, String(workerData.frame).padStart(8, '0'))
  data = {
    frame: workerData.frame,
    image: `app://${basepath}.jpg`,
    thumbnail: `app://${basepath}_mini.jpg`
  }
}
parentPort.postMessage({ data })
