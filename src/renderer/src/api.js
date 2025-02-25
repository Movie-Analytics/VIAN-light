import { useTempStore } from '@renderer/stores/temp'
import { useMainStore } from '@renderer/stores/main'

class RemoteApi {
  constructor() {
    this.callbacks = {
      'export-screenshots': this.onExportScreenhots
    }
    this.jobUpdate = null
    this.tokenUpdate = null
    this.bearerToken = null
    this.base_api = '/'
    if (import.meta.env.DEV) {
      this.base_api = '/api/'
    }
    if (import.meta.env.VITE_API_BASE) {
      this.base_api = import.meta.env.VITE_API_BASE
    }
  }

  async login(email, password) {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)

    const response = await fetch(this.base_api + 'login', {
      method: 'POST',
      body: formData
    })
    if (response.ok) {
      const json_response = await response.json()
      const token = json_response.access_token
      this.bearerToken = token
      localStorage.setItem('token', token)

      this.startJobUpdateFetch()
      this.intervalCheckToken()
      return true
    }
    return false
  }

  intervalCheckToken() {
    if (this.tokenUpdate !== null) return

    this.tokenUpdate = setInterval(
      async () => {
        if (!(await this.checkToken())) {
          this.tokenUpdate = null
          this.logout()
        }
      },
      15 * 60 * 1000
    )
  }

  async checkToken() {
    let token = this.bearerToken
    if (token === null) {
      token = localStorage.getItem('token')
    }
    if (token === null) return false

    const response = await fetch(this.base_api + 'renew-token', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    if (response.ok) {
      const token = (await response.json()).access_token
      this.bearerToken = token
      localStorage.setItem('token', token)
      this.startJobUpdateFetch()
      return true
    }
    return false
  }

  async signup(email, password) {
    const response = await fetch(this.base_api + 'signup', {
      method: 'POST',
      body: JSON.stringify({
        email: email,
        password: password
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      }
    })
    return response.ok
  }

  openVideo() {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'video/mp4'

      fileInput.onchange = async (event) => {
        const file = event.target.files[0]
        if (!file) {
          resolve(null)
        }

        try {
          const token = this.bearerToken
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(this.base_api + 'upload-video', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          })

          if (!response.ok) {
            resolve(null)
          }

          const result = await response.json()
          resolve(result)
        } catch (error) {
          resolve(null)
        }
      }
      fileInput.click()
    })
  }

  async loadStore(name, id) {
    const token = this.bearerToken

    const response = await fetch(this.base_api + 'load-store', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        name: name,
        id: id || null
      })
    })

    if (response.ok) return response.json()
    else return null
  }

  async saveStore(name, store) {
    const token = this.bearerToken
    let id = null
    if (name !== 'meta') {
      id = store.id
    }

    const response = await fetch(this.base_api + 'save-store', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        name: name,
        id: id,
        data: store
      })
    })

    return response.ok
  }

  logout() {
    localStorage.setItem('token', null)
    clearInterval(this.tokenUpdate)
    this.bearerToken = null
  }

  onJobsUpdate(cb) {
    this.callbacks['jobs-update'] = cb
  }

  async getVideoInfo(video) {
    this.callbacks['jobs-update'](await this.getJobs())

    const response = await fetch(this.base_api + 'get-video-info', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        video: video,
        id: useMainStore().id
      })
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  onVideoInfo(cb) {
    this.callbacks['video-info'] = cb
  }
  onScreenshotsGeneration(cb) {
    this.callbacks['screenshots-generation'] = cb
  }
  onScreenshotGeneration(cb) {
    this.callbacks['screenshot-generation'] = cb
  }

  async runShotBoundaryDetection(video) {
    this.callbacks['jobs-update'](await this.getJobs())

    const response = await fetch(this.base_api + 'shotboundary-detection', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        video: video,
        id: useMainStore().id
      })
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  loadSubtitles(id) {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'application/x-subrip'

      fileInput.onchange = async (event) => {
        const file = event.target.files[0]
        if (!file) {
          resolve(null)
        }

        try {
          const token = this.bearerToken
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(this.base_api + `upload-subtitles/${id}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          })

          if (!response.ok) {
            resolve(null)
          }

          const result = await response.json()
          resolve(result.location)
        } catch (error) {
          console.log('Error', error)
          resolve(null)
        }
      }
      fileInput.click()
    })
  }

  onShotBoundaryDetection(cb) {
    this.callbacks['shotboundary-detection'] = cb
  }

  async getJobs() {
    const response = await fetch(this.base_api + 'get-jobs/' + useMainStore().id, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      }
    })
    return await response.json()
  }

  startJobUpdateFetch() {
    if (this.jobUpdate !== null) return

    this.jobUpdate = setInterval(async () => {
      const token = this.bearerToken

      try {
        const jobs = await this.getJobs()
        if (jobs.every((j) => j.status !== 'RUNNING')) {
          clearInterval(this.jobUpdate)
          this.jobUpdate = null
        }

        const oldJobs = useTempStore().jobs
        const oldJobsDone = oldJobs.filter((o) => o.status === 'DONE').map((o) => o.id)
        jobs
          .filter((j) => j.status === 'DONE' && !oldJobsDone.includes(j.id))
          .forEach(async (j) => {
            // fetch results for newly finished jobs
            const response = await fetch(this.base_api + `get-result/${j.id}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-type': 'application/json; charset=UTF-8'
              }
            })
            if (response.ok) this.callbacks[j.type]((await response.json()).data)
          })
        this.callbacks['jobs-update'](jobs)
      } catch (e) {
        console.log('Error fetching job update', e)
        clearInterval(this.jobUpdate)
        this.jobUpdate = null
      }
    }, 2000)
  }

  async runScreenshotsGeneration(video, frames, projectid) {
    this.callbacks['jobs-update'](await this.getJobs())

    const response = await fetch(this.base_api + 'screenshots-generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        video: video,
        frames: frames,
        id: projectid
      })
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  async runScreenshotGeneration(video, frame, projectid) {
    return await this.runScreenshotsGeneration(video, [frame], projectid)
  }

  async terminateJob(id) {
    const token = this.bearerToken

    const response = await fetch(this.base_api + `terminate-job/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-type': 'application/json; charset=UTF-8'
      }
    })

    return response.ok
  }

  async exportScreenshots(projectId, frames) {
    const token = this.bearerToken

    const response = await fetch(this.base_api + 'export-screenshots', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        frames: frames,
        id: projectId
      })
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  onExportScreenhots(url) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'screenshots.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

// eslint-disable-next-line
const api = isElectron ? window.electronAPI : new RemoteApi()

export default api
