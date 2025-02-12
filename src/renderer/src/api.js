let api

if (isElectron) {
  api = window.electronAPI
} else {
  api = {
  }
}

export default api
