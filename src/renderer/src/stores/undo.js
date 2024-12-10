import { defineStore } from 'pinia'

export const useUndoStore = defineStore('undo', {
  state: () => ({
    stack: {}
  }),
  actions: {
    isUndoable(name) {
      return this.stack[name] !== undefined && this.stack[name].length > 1
    },
    push(name, store) {
      if (this.stack[name] === undefined) {
        this.stack[name] = []
      }
      this.stack[name].push(store)
      if (this.stack[name].length > 30) {
        this.stack[name].shift()
      }
    },
    undo(name) {
      if (this.isUndoable(name)) {
        this.stack[name].pop()
        return this.stack[name].pop()
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
