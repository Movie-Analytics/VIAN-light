import { BrowserWindow, app } from 'electron'

const createMenu = () => {
  const template = [
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
      label: 'Playback',
      submenu: [
        {
          accelerator: 'Space',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('toggle-playback')
          },
          label: 'Play/Pause'
        },
        {
          accelerator: 'Right',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('frame-forward')
          },
          label: 'Frame Forward'
        },
        {
          accelerator: 'Left',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('frame-backward')
          },
          label: 'Frame Backward'
        },
        { type: 'separator' },
        {
          accelerator: 'j',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('playback-backward')
          },
          label: 'Play Backward (J)'
        },
        {
          accelerator: 'k',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('stop-playback')
          },
          label: 'Stop (K)'
        },
        {
          accelerator: 'l',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('playback-forward')
          },
          label: 'Play Forward (L)'
        }
      ]
    },
    {
      label: 'Navigation',
      submenu: [
        {
          accelerator: 'a',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('segment-previous')
          },
          label: 'Previous Segment'
        },
        {
          accelerator: 's',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('segment-next')
          },
          label: 'Next Segment'
        }
      ]
    }
  ]

  // Add macOS-specific menu items
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  return template
}

export { createMenu }
