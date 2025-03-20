const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

const exportProject = async (projectPath, location) => {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-project-'))

  fs.cpSync(projectPath, tmpPath, { recursive: true })

  const finalLocation = location.endsWith('.zip') ? location : `${location}.zip`
  const output = fs.createWriteStream(finalLocation)
  const archive = archiver('zip')

  archive.pipe(output)
  archive.directory(tmpPath, false)
  await archive.finalize()
  fs.rmSync(tmpPath, { recursive: true })
}

console.log('Started project export worker')

exportProject(workerData.projectPath, workerData.location)
  .then(() => {
    parentPort.postMessage(true)
  })
  .catch((err) => {
    throw err
  })
