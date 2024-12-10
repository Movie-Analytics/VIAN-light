const fs = require('fs')
const path = require('path')
const os = require('os')
const WASI = require('wasi')

import ffmpegPath from '../../resources/ffmpeg.wasm?asset'

// ffmpeg from https://github.com/SebastiaanYN/FFmpeg-WASI
export async function generateThumbnails(filePath, tmpPath) {
  const wasi = new WASI.WASI({
    version: 'preview1',
    args: [
      'ffmpeg',
      '-i',
      '/insandbox/' + path.basename(filePath),
      '-vf',
      'scale=48:27',
      '/sandbox/%08d.jpg'
    ],
    env: {},
    preopens: {
      '/sandbox': tmpPath,
      '/insandbox': path.dirname(filePath)
    }
  })
  const wasm = await WebAssembly.compile(fs.readFileSync(ffmpegPath))
  const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject())

  wasi.start(instance)
export async function getVideoInfo(filePath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-lite-'))
  const tmpPath = path.join(tmpDir, 'ffmpeg.log')
  const stream = fs.createWriteStream(tmpPath)
  await new Promise((resolve, reject) => {
    stream.on('open', (fd) => resolve(fd))
    stream.on('error', (err) => reject(err))
  })

  const wasi = new WASI.WASI({
    version: 'preview1',
    args: ['ffmpeg', '-i', '/insandbox/' + path.basename(filePath)],
    env: {},
    preopens: {
      '/insandbox': path.dirname(filePath)
    },
    stderr: stream.fd
  })
  const wasm = await WebAssembly.compile(fs.readFileSync(ffmpegPath))
  const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject())

  wasi.start(instance)

  const ffmpegInfo = fs.readFileSync(tmpPath, 'utf-8')
  const fps = ffmpegInfo.match(/(\d+(.\d+)?) fps/)[1]

  fs.rmSync(tmpDir, { recursive: true, force: true })

  return { fps: parseFloat(fps) }
}
