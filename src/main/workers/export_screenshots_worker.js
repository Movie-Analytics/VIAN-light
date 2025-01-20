const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

async function exportScreenshots(storePath, location, frames) {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-screenshots-'))

  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'))

  store.timelines.forEach((t) => {
    if (!t.type.startsWith('screenshots')) return
    const timelinePath = path.join(tmpPath, `${t.name}-${t.id}`)
    fs.mkdirSync(timelinePath)
    t.data.forEach((s) => {
      const imagePath = s.image.replace('app://', '')
      if (frames && !frames.includes(Number(path.basename(imagePath).replace('.jpg', '')))) return
      fs.copyFileSync(imagePath, path.join(timelinePath, path.basename(imagePath)))
    })
  })

  if (!location.endsWith('.zip')) location += '.zip'
  const output = fs.createWriteStream(location)
  const archive = archiver('zip')

  archive.pipe(output)
  archive.directory(tmpPath, false)
  await archive.finalize()
  fs.rmSync(tmpPath, { recursive: true })
}

console.log('Started screenshot export worker')
if (workerData !== null && workerData !== undefined) {
  exportScreenshots(workerData.storePath, workerData.location, workerData.frames).then((err) => {
    if (err) throw err
    else parentPort.postMessage(true)
  })
}
