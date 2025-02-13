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
    <v-card-text :style="cardTextStyle">
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
  props: {
    title: String,
    z: Number,
    xInitial: Number,
    yInitial: Number,
    widthInitial: Number,
    heightInitial: Number
  },
  emits: ['dragged'],
  data: () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0
  }),
  computed: {
    styles() {
      return {
        position: 'absolute',
        left: `${this.x}px`,
        top: `${this.y}px`,
        width: `${this.width}px`,
        height: `${this.height}px`,
        'z-index': this.z
      }
    },
    cardTextStyle() {
      return { height: `${this.height - 48}px` }
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
      if (evt.clientX == 0 && evt.clientY == 0) return
      this.x = evt.clientX - this.offsetX
      this.y = evt.clientY - this.offsetY
    },
    resizeDragStart(evt) {
      this.offsetX = evt.clientX - (this.x + this.width)
      this.offsetY = evt.clientY - (this.y + this.height)
    },
    resizeOnDrag(evt) {
      // prevent bug with very quick and short drags
      if (evt.clientX == 0 && evt.clientY == 0) return
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
