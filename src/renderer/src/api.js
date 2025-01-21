export function api() {
  if (isElectron) {
    return window.electronAPI
  }
}
