const { workerData, parentPort } = require('worker_threads')
const path = require('path')

import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to generate screenshots', workerData)

const reader = new videoReader.VideoReader(workerData.videoPath)
reader.open()
reader.generateScreenshots(workerData.directory, workerData.frames, (err, result) => {
  if (err) {
    parentPort.postMessage({ status: 'CANCELED' })
  } else if (result) {
    parentPort.postMessage({
      data: workerData.frames.map((f) => {
        const basepath = path.join(workerData.directory, String(f).padStart(8, '0'))
        return {
          frame: f,
          image: `app://${basepath}.jpg`,
          thumbnail: `app://${basepath}_mini.jpg`
        }
      }),
      status: 'DONE'
    })
  } else {
    parentPort.postMessage({ data: [], status: 'DONE' })
  }
})

parentPort.on('message', (e) => {
  if (e.type === 'TERMINATE') {
    reader.cancelOperation()
  }
})
