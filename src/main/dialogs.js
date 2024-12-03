const { dialog } = require('electron')

export function selectFile(filters) {
  const files = dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: filters
  })
  if (files === undefined) return undefined
  return files[0]
}
