# vian-light

A video annotation software built with Electron and Vue.js.

## Project Setup: Electron

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

## Project Setup: Web

### Development

Install the dependecies (example using [uv](https://docs.astral.sh/uv/) and apt):

```bash
$ cd server
$ uv venv
$ apt install redis
```

Start `redis`, `celery`, `fastapi`, and `vite`:

```bash
$ redis-server
$ npm run web
$ cd server
$ uv run celery -b redis://localhost:6379/0 --result-backend redis://localhost:6379/0 -A tasks worker
$ uv run fastapi run main.py
```


### Deployment via Docker

```bash
$ cd docker
$ docker compose up --build
```

### Linting

Before committing, run:
```bash
# Check JavaScript/TypeScript code style
npm run lint

# Linting Python
cd server
uvx ruff check
uvx pyright
```
