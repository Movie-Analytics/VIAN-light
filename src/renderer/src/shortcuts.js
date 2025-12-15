class ShorcutsManager {
  constructor() {
    this.keyMap = new Map()
    document.onkeydown = (event) => {
      const el = event.target
      if (
        el.tagName === 'INPUT' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'TEXTAREA' ||
        (el.contentEditable && el.contentEditable === 'true')
      ) {
        return
      }

      const hitCombi = event.key + event.shiftKey + event.ctrlKey + event.metaKey
      if (this.keyMap.has(hitCombi)) {
        event.preventDefault()
        this.keyMap.get(hitCombi)()
      }
    }
  }

  clear(key, shiftkey = false, ctrlkey = false, metakey = false) {
    this.keyMap.delete(key + shiftkey + ctrlkey + metakey)
  }

  register(key, callback, shiftkey = false, ctrlkey = false, metakey = false) {
    const hitCombi = key + shiftkey + ctrlkey + metakey
    if (this.keyMap.has(hitCombi)) {
      console.warn('Shortcut already registered. Overwriting.')
    }
    this.keyMap.set(key + shiftkey + ctrlkey + metakey, callback)
  }
}

const shortcuts = new ShorcutsManager()
export default shortcuts
