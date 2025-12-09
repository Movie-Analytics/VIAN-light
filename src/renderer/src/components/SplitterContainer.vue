<template>
  <div ref="parent" class="d-flex w-100" :class="{ 'flex-column': isVertical }">
    <div :style="panel1Style" class="d-flex height-min-0">
      <slot name="panel1"></slot>
    </div>

    <div
      class="align-center d-flex justify-center"
      :class="[isVertical ? 'gutter-horizontal' : 'gutter-vertical']"
      @mousedown="onGutterMouseDown"
      @touchstart="onGutterTouchStart"
    >
      <div class="bg-grey-lighten-3"></div>
    </div>

    <div :style="panel2Style" class="d-flex height-min-0">
      <slot name="panel2"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SplitterContainer',

  props: {
    horizontalBreakpoint: {
      default: null,
      required: false,
      type: Number
    },

    initalPanel1Percent: {
      default: 50,
      required: false,
      type: Number
    },

    layout: {
      default: 'horizontal',
      required: false,
      type: String
    }
  },

  data() {
    return {
      currentLayout: this.layout,
      isDragging: false,
      mouseMoveListener: null,
      mouseUpListener: null,
      panel1Percent: this.initalPanel1Percent,
      panel2Percent: 100 - this.initalPanel1Percent,
      resizeObserver: null
    }
  },

  computed: {
    isVertical() {
      return this.currentLayout === 'vertical'
    },

    panel1Style() {
      return {
        'flex-basis': `calc(${this.panel1Percent}% - 7.5px)`
      }
    },

    panel2Style() {
      return {
        'flex-basis': `calc(${this.panel2Percent}% - 7.5px)`
      }
    }
  },

  mounted() {
    if (this.currentLayout === 'horizontal' && this.horizontalBreakpoint !== null) {
      this.resizeObserver = new ResizeObserver(this.handleElementResize)
      this.resizeObserver.observe(this.$refs.parent)
    }
  },

  beforeUnmount() {
    if (this.resizeObserver !== null) {
      this.resizeObserver.unobserve(this.$refs.parent)
    }
  },

  methods: {
    handleElementResize(e) {
      if (e[0].contentRect.width < this.horizontalBreakpoint) {
        this.currentLayout = 'vertical'
      } else {
        this.currentLayout = 'horizontal'
      }
    },

    mouseMove(e) {
      this.resize(e)
    },

    mouseUp() {
      document.removeEventListener('mousemove', this.mouseMove)
      document.removeEventListener('mouseup', this.mouseUp)
    },

    onGutterMouseDown(e) {
      this.resizeStart(e)
    },

    onGutterTouchStart(e) {
      this.resizeStart(e)
    },

    resize(e) {
      e.preventDefault()

      const rect = this.$refs.parent.getBoundingClientRect()
      const mousePos =
        this.currentLayout === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top
      const parentSize =
        this.currentLayout === 'horizontal'
          ? this.$refs.parent.offsetWidth
          : this.$refs.parent.offsetHeight

      this.panel1Percent = (mousePos / parentSize) * 100
      this.panel2Percent = ((parentSize - mousePos) / parentSize) * 100
    },

    resizeStart(e) {
      e.preventDefault()
      document.addEventListener('mousemove', this.mouseMove)
      document.addEventListener('mouseup', this.mouseUp)
    }
  }
}
</script>

<style scoped>
.gutter-horizontal {
  cursor: ns-resize;
  height: 10px;
}
.gutter-horizontal > div {
  height: 3px;
  width: calc(100% - 100px);
  min-width: 50px;
}

.gutter-vertical {
  cursor: ew-resize;
  width: 15px;
}
.gutter-vertical > div {
  width: 3px;
  height: calc(100% - 100px);
  min-height: 50px;
}
</style>
