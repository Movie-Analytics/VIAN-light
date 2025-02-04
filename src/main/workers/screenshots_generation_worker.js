const { workerData, parentPort } = require('worker_threads')

import video_reader_p from '../../../resources/video_reader.node?asset&asarUnpack'
const video_reader = require(video_reader_p)

console.log('Started worker to generate screenshots', workerData)
if (workerData !== null && workerData !== undefined) {
  const reader = new video_reader.VideoReader(workerData.videoPath)
  reader.open()
  reader.generateScreenshots(workerData.directory, workerData.frames, (err, result) => {
    if (err) {
      parentPort.postMessage({ status: 'CANCELED' })
    } else if (!result) {
      parentPort.postMessage({ status: 'DONE', data: [] })
    } else {
      parentPort.postMessage({
        status: 'DONE',
        data: workerData.frames.map((f) => ({
          frame: f,
          thumbnail: `app://${workerData.directory}/${String(f).padStart(8, '0')}_mini.jpg`,
          image: `app://${workerData.directory}/${String(f).padStart(8, '0')}.jpg`
        }))
      })
    }
  })

  parentPort.on('message', (e) => {
    if (e.type === 'TERMINATE') {
      reader.cancelOperation()
    }
  })
}
