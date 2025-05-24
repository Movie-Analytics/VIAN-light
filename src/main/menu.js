import { BrowserWindow, app } from 'electron'

const createMenu = () => {
  if (process.platform === 'darwin') {
    return [
      {
        label: 'VIAN-light',
        submenu: [
          { label: `About ${app.getName()}`, role: 'about' },
          { type: 'separator' },
          { label: 'Services', role: 'services' },
          { type: 'separator' },
          { label: `Hide ${app.getName()}`, role: 'hide' },
          { label: 'Hide Others', role: 'hideOthers' },
          { label: 'Show All', role: 'unhide' },
          { type: 'separator' },
          { label: `Quit ${app.getName()}`, role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {
            accelerator: 'CmdOrCtrl+Z',
            click: () => {
              BrowserWindow.getFocusedWindow()?.webContents.send('undo-action')
            },
            label: 'Undo'
          },
          {
            accelerator: 'CmdOrCtrl+Shift+Z',
            click: () => {
              BrowserWindow.getFocusedWindow()?.webContents.send('redo-action')
            },
            label: 'Redo'
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { label: 'Minimize', role: 'minimize' },
          { label: 'Zoom', role: 'zoom' },
          { type: 'separator' },
          { label: 'Bring All to Front', role: 'front' }
        ]
      }
    ]
  }
  return null
}

export default createMenu
