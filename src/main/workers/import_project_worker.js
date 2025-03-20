const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const yauzl = require('yauzl')

const importProject = (videoPath, zipPath, dataPath) => {
  return new Promise((resolve, reject) => {
    const name = path.basename(zipPath)
    const id = crypto.randomUUID()
    const projectPath = path.join(dataPath, id)

    fs.mkdirSync(projectPath, { recursive: true })

    yauzl.open(zipPath, (err, zipfile) => {
      if (err) reject(err)
      zipfile.on('error', reject)

      const extractionPromises = []

      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          fs.mkdirSync(path.join(projectPath, entry.fileName), { recursive: true })
        } else {
          const extractPromise = new Promise((resolveExtract, rejectExtract) => {
            zipfile.openReadStream(entry, (err3, readStream) => {
              if (err3) rejectExtract(err3)

              const entryPath = path.join(projectPath, entry.fileName)
              const writeStream = fs.createWriteStream(entryPath)

              readStream.on('end', () => {
                console.log('Extracted:', entry.fileName)
                resolveExtract()
              })

              readStream.on('error', rejectExtract)
              writeStream.on('error', rejectExtract)
              readStream.pipe(writeStream)
            })
          })

          extractionPromises.push(extractPromise)
        }
      })

      zipfile.on('end', () => {
        Promise.all(extractionPromises)
          .then(() => {
            try {
              const mainStore = JSON.parse(
                fs.readFileSync(path.join(projectPath, 'main.json'), 'utf8')
              )
              const undoableStore = JSON.parse(
                fs.readFileSync(path.join(projectPath, 'undoable.json'), 'utf8')
              )

              mainStore.video = 'app://' + videoPath
              mainStore.id = id
              undoableStore.id = id

              if (undoableStore.subtitles !== null) {
                undoableStore.subtitles = 'app://' + path.join(projectPath, 'subtitles.vtt')
              }

              undoableStore.timelines.forEach((t) => {
                if (t.type.startsWith('screenshot')) {
                  t.data.forEach((d) => {
                    d.image =
                      'app://' + path.join(projectPath, 'screenshots', path.basename(d.image))
                    d.thumbnail =
                      'app://' + path.join(projectPath, 'screenshots', path.basename(d.thumbnail))
                  })
                }
              })

              fs.writeFileSync(
                path.join(projectPath, 'main.json'),
                JSON.stringify(mainStore),
                'utf8'
              )
              fs.writeFileSync(
                path.join(projectPath, 'undoable.json'),
                JSON.stringify(undoableStore),
                'utf8'
              )

              resolve({ id, name })
            } catch (storeErr) {
              reject(storeErr)
            }
          })
          .catch(reject)
      })
    })
  })
}

console.log('Started project import worker', workerData)

importProject(workerData.videoFile, workerData.zipFile, workerData.dataPath)
  .then((result) => {
    parentPort.postMessage(result)
  })
  .catch((err) => {
    throw err
  })
