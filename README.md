# vian-lite

A video annotation software built with Electron and Vue.js.

## Project Setup

### Download libraries
- Download the TransNetv2 onnx model [here](https://huggingface.co/elya5/transnetv2) and move it to resources
- Download pre-compiled ffmpeg libraries [here](https://github.com/elya5/ffmpeg-build) and move it to `ffmpeglibs`.
- Download pre-compiled onnxruntime [here](https://github.com/csukuangfj/onnxruntime-libs) and move it to `onnxlibs`.

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
