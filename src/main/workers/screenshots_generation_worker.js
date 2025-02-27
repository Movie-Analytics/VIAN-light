const { workerData, parentPort } = require('worker_threads')

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
      data: workerData.frames.map((f) => ({
        frame: f,
        image: `app://${workerData.directory}/${String(f).padStart(8, '0')}.jpg`,
        thumbnail: `app://${workerData.directory}/${String(f).padStart(8, '0')}_mini.jpg`
      })),
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
