import { defineStore } from 'pinia'

export const useUndoStore = defineStore('undo', {
  state: () => ({
    stack: {}
  }),
  actions: {
    isUndoable(name) {
      return this.stack[name] !== undefined && this.stack[name].index > 0
    },
    isRedoable(name) {
      return (
        this.stack[name] !== undefined &&
        this.stack[name].index < this.stack[name].entries.length - 1
      )
    },
    push(name, store) {
      if (this.stack[name] === undefined) {
        this.stack[name] = { index: -1, entries: [], ignoreNext: false }
      }
      if (this.stack[name].ignoreNext) {
        this.stack[name].ignoreNext = false
        return
      }

      this.stack[name].entries = this.stack[name].entries.slice(0, this.stack[name].index + 1)
      this.stack[name].entries.push(store)
      this.stack[name].index++
      if (this.stack[name].entries.length > 30) {
        this.stack[name].entries.shift()
        this.stack[name].index--
      }
    },
    undo(name) {
      if (this.isUndoable(name)) {
        this.stack[name].index--
        this.stack[name].ignoreNext = true
        return JSON.parse(JSON.stringify(this.stack[name].entries[this.stack[name].index]))
      }
    },
    redo(name) {
      if (this.isRedoable(name)) {
        this.stack[name].index++
        this.stack[name].ignoreNext = true
        return JSON.parse(JSON.stringify(this.stack[name].entries[this.stack[name].index]))
      }
    },
    reset() {
      for (const key of Object.keys(this.stack)) {
        if (key !== 'meta') {
          delete this.stack[key]
        }
      }
    }
  }
})
