class ShorcutsManager {
  constructor() {
    this.keyMap = new Map()
    document.onkeyup = (event) => {
      const el = event.target
      if (
        el.tagName === 'INPUT' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'TEXTAREA' ||
        (el.contentEditable && el.contentEditable === 'true')
      ) {
        return
      }

      const hitCombi = event.key + event.shiftKey + event.ctrlKey
      if (this.keyMap.has(hitCombi)) {
        event.preventDefault()
        this.keyMap.get(hitCombi)()
      }
    }
  }

  clear(key, shiftkey = false, ctrlkey = false) {
    this.keyMap.delete(key + shiftkey + ctrlkey)
  }

  register(key, callback, shiftkey = false, ctrlkey = false) {
    const hitCombi = key + shiftkey + ctrlkey
    if (this.keyMap.has(hitCombi)) {
      console.warn('Shortcut already registered. Overwriting.')
    }
    this.keyMap.set(key + shiftkey + ctrlkey, callback)
  }
}

const shortcuts = new ShorcutsManager()
export default shortcuts
