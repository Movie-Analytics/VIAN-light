const { workerData, parentPort } = require('worker_threads')

import video_reader_p from '../../../resources/video_reader.node?asset&asarUnpack'
import onnxPath from '../../../resources/transnetv2.onnx?asset&asarUnpack'
const video_reader = require(video_reader_p)

console.log('Started worker to detect shot boundaries')
if (workerData !== null && workerData !== undefined) {
  const reader = new video_reader.VideoReader(workerData)
  reader.open()
  reader.detectShots(onnxPath, (err, result) => {
    if (err) {
      parentPort.postMessage({ status: 'CANCELED' })
    } else {
      parentPort.postMessage({ status: 'DONE', shots: result })
    }
  })

  parentPort.on('message', (e) => {
    if (e.type === 'TERMINATE') {
      reader.cancelOperation()
    }
  })
}
