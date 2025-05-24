const { workerData, parentPort } = require('worker_threads')

import onnxPath from '../../../resources/transnetv2.onnx?asset&asarUnpack'
import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to detect shot boundaries')

let reader = null
try {
  reader = new videoReader.VideoReader(workerData)
  reader.open()
  reader.detectShots(onnxPath, (err, result) => {
    if (err) {
      parentPort.postMessage({ status: 'CANCELED' })
    } else {
      parentPort.postMessage({ shots: result, status: 'DONE' })
    }
  })
} catch (err) {
  console.error('Error in shot boundary worker:', err)
  parentPort.postMessage({
    error: err.message,
    status: 'ERROR'
  })
}

parentPort.on('message', (e) => {
  try {
    if (e.type === 'TERMINATE') {
      if (reader) {
        reader.cancelOperation()
      }
    } else if (e.type === 'CLEANUP') {
      if (reader) {
        reader.cleanup()
        reader = null
      }
    }
  } catch (err) {
    console.error('Error handling message in worker:', err)
    parentPort.postMessage({
      error: err.message,
      status: 'ERROR'
    })
  }
})
