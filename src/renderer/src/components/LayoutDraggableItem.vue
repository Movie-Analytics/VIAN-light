<template>
  <v-card :style="styles" @dragover.prevent>
    <v-card-title>
      <v-icon
        size="x-small"
        draggable="true"
        @drag="moveOnDrag"
        @dragstart="moveDragStart"
        @dragend="moveOnDrag"
      >
        mdi-cursor-move
      </v-icon>
      {{ title }}
    </v-card-title>

    <v-card-text :style="cardTextStyle" class="d-flex flex-1-1 flex-column height-min-0">
      <slot></slot>
    </v-card-text>

    <v-icon
      id="resize-icon"
      icon
      draggable="true"
      @drag="resizeOnDrag"
      @dragstart="resizeDragStart"
      @dragend="resizeOnDrag"
    >
      mdi-resize-bottom-right
    </v-icon>
  </v-card>
</template>

<script>
export default {
  name: 'LayoutDraggableItem',

  props: {
    heightInitial: Number,
    title: String,
    widthInitial: Number,
    xInitial: Number,
    yInitial: Number,
    z: Number
  },

  emits: ['dragged'],

  data: () => ({
    height: 0,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    x: 0,
    y: 0
  }),

  computed: {
    cardTextStyle() {
      return { height: `${this.height - 48}px` }
    },

    styles() {
      return {
        height: `${this.height}px`,
        left: `${this.x}px`,
        position: 'absolute',
        top: `${this.y}px`,
        width: `${this.width}px`,
        'z-index': this.z
      }
    }
  },

  created() {
    this.x = this.xInitial
    this.y = this.yInitial
    this.width = this.widthInitial
    this.height = this.heightInitial
  },

  methods: {
    moveDragStart(evt) {
      this.offsetX = evt.clientX - this.x
      this.offsetY = evt.clientY - this.y
      this.$emit('dragged', this.title)
    },

    moveOnDrag(evt) {
      // Prevent bug with very quick and short drags. "preventDefault" does not suffice?
      if (evt.clientX === 0 && evt.clientY === 0) return
      this.x = evt.clientX - this.offsetX
      this.y = evt.clientY - this.offsetY
    },

    resizeDragStart(evt) {
      this.offsetX = evt.clientX - (this.x + this.width)
      this.offsetY = evt.clientY - (this.y + this.height)
    },

    resizeOnDrag(evt) {
      // Prevent bug with very quick and short drags
      if (evt.clientX === 0 && evt.clientY === 0) return
      this.width = evt.clientX - this.offsetX - this.x
      this.height = evt.clientY - this.offsetY - this.y
    }
  }
}
</script>

<style scoped>
#resize-icon {
  position: absolute;
  bottom: 0;
  right: 0;
}
</style>
