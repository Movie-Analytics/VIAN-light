const { workerData, parentPort } = require('worker_threads')

import video_reader_p from '../../resources/video_reader.node?asset&asarUnpack'
const video_reader = require(video_reader_p)

console.log('Started worker to retrieve video info')
if (workerData !== null && workerData !== undefined) {
  const reader = new video_reader.VideoReader(workerData)
  reader.open()
  const fps = reader.getFrameRate()
  parentPort.postMessage({ fps: fps })
}
