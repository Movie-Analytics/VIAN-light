const { workerData, parentPort } = require('worker_threads')

import { getVideoInfo } from './ffmpeg'

if (workerData !== null && workerData !== undefined) {
  getVideoInfo(workerData).then((e) => parentPort.postMessage(e))
}
