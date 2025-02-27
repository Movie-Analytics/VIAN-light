const { workerData, parentPort } = require('worker_threads')

import onnxPath from '../../../resources/transnetv2.onnx?asset&asarUnpack'
import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to detect shot boundaries')

const reader = new videoReader.VideoReader(workerData)
reader.open()
reader.detectShots(onnxPath, (err, result) => {
  if (err) {
    parentPort.postMessage({ status: 'CANCELED' })
  } else {
    parentPort.postMessage({ shots: result, status: 'DONE' })
  }
})

parentPort.on('message', (e) => {
  if (e.type === 'TERMINATE') {
    reader.cancelOperation()
  }
})
