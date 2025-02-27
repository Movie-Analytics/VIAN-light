import { defineStore } from 'pinia'

export const useUndoStore = defineStore('undo', {
  state: () => ({
    stack: {}
  }),
  /* eslint-disable-next-line vue/sort-keys */
  actions: {
    isRedoable(name) {
      return name in this.stack && this.stack[name].index < this.stack[name].entries.length - 1
    },
    isUndoable(name) {
      return name in this.stack && this.stack[name].index > 0
    },
    push(name, store) {
      if (!(name in this.stack)) {
        this.stack[name] = { entries: [], ignoreNext: false, index: -1 }
      }
      if (this.stack[name].ignoreNext) {
        this.stack[name].ignoreNext = false
        return
      }

      this.stack[name].entries = this.stack[name].entries.slice(0, this.stack[name].index + 1)
      this.stack[name].entries.push(store)
      this.stack[name].index += 1
      if (this.stack[name].entries.length > 30) {
        this.stack[name].entries.shift()
        this.stack[name].index -= 1
      }
    },
    redo(name) {
      if (this.isRedoable(name)) {
        this.stack[name].index += 1
        this.stack[name].ignoreNext = true
        return JSON.parse(JSON.stringify(this.stack[name].entries[this.stack[name].index]))
      }
      throw new Error('Not redoable')
    },
    reset() {
      for (const key of Object.keys(this.stack)) {
        if (key !== 'meta') {
          delete this.stack[key]
        }
      }
    },
    undo(name) {
      if (this.isUndoable(name)) {
        this.stack[name].index -= 1
        this.stack[name].ignoreNext = true
        return JSON.parse(JSON.stringify(this.stack[name].entries[this.stack[name].index]))
      }
      throw new Error('Not undoable')
    }
  }
})
