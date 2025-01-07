const { workerData } = require('worker_threads')
const fs = require('fs')
const path = require('path')

// Deletes unreferenced projects and images. This cannot happen immediately
// upon user action to provide undo functionality.

function cleanProjects(vianPath, projects) {
  fs.readdirSync(vianPath, { withFileTypes: true })
    .filter((i) => i.isDirectory())
    .forEach((d) => {
      if (!projects.has(d.name)) {
        console.log('Deleting unreferenced project', d.name, path.join(vianPath, d.name))
        fs.rmSync(path.join(vianPath, d.name), { recursive: true })
      }
    })
}

function cleanScreenshots(projectPath) {
  const content = fs.readFileSync(path.join(projectPath, 'undoable.json'), 'utf8')
  const timelines = JSON.parse(content).timelines
  const referencedImgs = new Set()
  timelines.forEach((t) => {
    t.data.forEach((d) => {
      if (d.image !== undefined) referencedImgs.add(d.image.replace('app://', ''))
      if (d.thumbnail !== undefined) referencedImgs.add(d.thumbnail.replace('app://', ''))
    })
  })

  let fsImgs
  try {
    fsImgs = fs
      .readdirSync(path.join(projectPath, 'screenshots'), { withFileTypes: true })
      .map((i) => path.join(i.parentPath, i.name))
  } catch (e) {
    return
  }

  const diff = new Set(fsImgs).difference(referencedImgs)
  diff.forEach((i) => {
    fs.rmSync(i)
  })
  if (diff.size > 0) console.log('Deleted %d screenshots', diff.size)
}

if (workerData !== null && workerData !== undefined) {
  console.log('Started cleanup worker')
  const vianPath = workerData
  const content = fs.readFileSync(path.join(vianPath, 'meta.json'), 'utf8')
  const projects = new Set(JSON.parse(content).projects.map((p) => p.id))

  cleanProjects(vianPath, projects)
  projects.forEach((p) => {
    cleanScreenshots(path.join(vianPath, p))
  })
  console.log('Cleanup done')
}
