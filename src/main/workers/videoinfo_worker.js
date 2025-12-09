const { workerData, parentPort } = require('worker_threads')

import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to retrieve video info')

const reader = new videoReader.VideoReader(workerData)
reader.open()
const fps = reader.getFrameRate()
const width = reader.getWidth()
const height = reader.getHeight()
const numFrames = reader.getNumFrames()
parentPort.postMessage({ fps, height, numFrames, width })
