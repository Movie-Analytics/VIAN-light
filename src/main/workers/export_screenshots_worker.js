const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

const exportScreenshots = async (storePath, location, frames) => {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-screenshots-'))

  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'))

  store.timelines.forEach((t) => {
    if (!t.type.startsWith('screenshots')) return
    const timelinePath = path.join(tmpPath, `${t.name}-${t.id}`)
    fs.mkdirSync(timelinePath)
    t.data.forEach((s) => {
      const imagePath = s.image.replace('app://', '')
      if (frames && !frames.includes(s.frame)) return
      fs.copyFileSync(imagePath, path.join(timelinePath, path.basename(imagePath)))
    })
  })

  const finalLocation = location.endsWith('.zip') ? location : `${location}.zip`
  const output = fs.createWriteStream(finalLocation)
  const archive = archiver('zip')

  archive.pipe(output)
  archive.directory(tmpPath, false)
  await archive.finalize()
  fs.rmSync(tmpPath, { recursive: true })
}

console.log('Started screenshot export worker')

exportScreenshots(workerData.storePath, workerData.location, workerData.frames).then((err) => {
  if (err) throw err
  else parentPort.postMessage(true)
})
