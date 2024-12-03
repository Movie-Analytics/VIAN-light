const fs = require('fs')
const path = require('path')
const jpeg = require('jpeg-js')
const ort = require('onnxruntime-node')

//import onnxPath from '../../resources/transnetv2.onnx?asset&asarUnpack'
//const ffmpeg = require('./ffmpeg')
import { generateThumbnails } from './ffmpeg'

async function fileToFrame(fileName) {
  var jpegData = fs.readFileSync(fileName)
  return [...jpeg.decode(jpegData, { useTArray: false, formatAsRGBA: false })['data']]
}

async function* inputIterator(frames) {
  const noPaddedFramesStart = 25
  const noPaddedFramesEnd = 25 + 50 - (frames.length % 50 !== 0 ? frames.length % 50 : 50)

  const startFrame = frames.slice(0, 1)
  const endFrame = frames.slice(-1)

  const paddedInputs = Array(noPaddedFramesStart)
    .fill(startFrame[0])
    .concat(frames)
    .concat(Array(noPaddedFramesEnd).fill(endFrame[0]))

  let ptr = 0
  while (ptr + 100 <= paddedInputs.length) {
    const out = []
    for (let i = ptr; i < ptr + 100; i++) {
      out.push(await fileToFrame(paddedInputs[i]))
    }
    const progress = ptr / paddedInputs.length
    ptr += 50
    yield { progress, out: [out] } // Wrap the output to simulate new axis
  }
}

async function runInference(frames, session) {
  const predictions = []

  for await (const { progress, out } of inputIterator(frames)) {
    const inpTensor = new ort.Tensor('float32', Float32Array.from(out.flat(4)), [1, 100, 27, 48, 3])

    const feeds = { input: inpTensor }
    const results = await session.run(feeds)
    const rawResult = results['534']

    const singleFramePred = Array.from(rawResult.data).slice(25, 75)
    const allFramesPred = Array.from(rawResult.data).slice(25, 75)

    predictions.push([singleFramePred, allFramesPred])
  }

  const singleFramePredCombined = [].concat(...predictions.map(([single]) => single))
  const allFramesPredCombined = [].concat(...predictions.map(([, all]) => all))

  return {
    singleFramePred: singleFramePredCombined.slice(0, frames.length),
    allFramesPred: allFramesPredCombined.slice(0, frames.length)
  }
}

function predictionsToScenes(predictions, threshold = 0.5) {
  const binaryPredictions = predictions.map((p) => (p > threshold ? 1 : 0))

  let scenes = [0]
  let tPrev = 0

  for (let i = 0; i < binaryPredictions.length; i++) {
    const t = binaryPredictions[i]
    if (tPrev === 0 && t === 1 && i !== 0) {
      scenes.push(i)
    }
    tPrev = t
  }

  if (tPrev === 0) {
    scenes.push(binaryPredictions.length - 1)
  }

  if (scenes.length === 0) {
    return [0, predictions.length - 1]
  }

  return scenes
}

async function shots() {
  console.log('shots')
  try {
    const session = await ort.InferenceSession.create('./resources/transnetv2.onnx') //onnxPath)
    const frameFiles = fs.readdirSync('out___').map((f) => path.join('out___', f))
    console.log('got files', frameFiles.length)
    const { singleFramePred, allFramesPred } = await runInference(frameFiles, session)
    const shotList = predictionsToScenes(singleFramePred, 0.5)
    console.log('got shotlist', shotList)
    return shotList
  } catch (error) {
    console.error(`Error during inference: ${error}`)
    return []
  }
}

async function shotBoundaryDetection(videoPath) {
  console.log('gen thumbnails')
  await generateThumbnails(videoPath)
  console.log('run shottie', videoPath)
  return await shots()
}
//////////////////////////////////
const { workerData, parentPort } = require('worker_threads')
if (workerData !== null && workerData !== undefined) {
  console.log('Running shotboundary detection for', workerData)
  shotBoundaryDetection(workerData).then((e) => {
    console.log('done')
    parentPort.postMessage({ e })
  })
}
async function onmessage(e) {
  console.log('received message', e.data)
  const shots = await shotBoundaryDetection(e.data)
  postMessage(shots)
}
