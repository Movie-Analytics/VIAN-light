const { workerData, parentPort } = require('worker_threads')

import video_reader_p from '../../../resources/video_reader.node?asset&asarUnpack'
const video_reader = require(video_reader_p)

console.log('Started worker to generate screenshot', workerData)
if (workerData !== null && workerData !== undefined) {
  const reader = new video_reader.VideoReader(workerData.videoPath)
  reader.open()
  const success = reader.generateScreenshot(workerData.directory, workerData.frame)
  let data = null
  if (success)
    data = {
      frame: workerData.frame,
      thumbnail: `app://${workerData.directory}/${String(workerData.frame).padStart(8, '0')}_mini.jpg`,
      image: `app://${workerData.directory}/${String(workerData.frame).padStart(8, '0')}.jpg`
    }
  parentPort.postMessage({ data: data })
}
