const fs = require('fs')
const path = require('path')
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
    //   stdout: myStream
  })
  const wasm = await WebAssembly.compile(fs.readFileSync(ffmpegPath)) //'./resources/ffmpeg.wasm'))
  const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject())

  wasi.start(instance)
}
