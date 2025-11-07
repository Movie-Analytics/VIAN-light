<template>
  <div class="tiling-manager">
    <div class="grid-container" ref="gridContainer">

      <template v-if="!isNarrow">
        <!-- Video column -->
        <div
          id="video-col"
          class="section video-col"
          :style="videoColStyle"
        >
          <v-card class="flex-grow-1 h-100 d-flex flex-column">
            <VideoPlayer />
          </v-card>
        </div>

        <!-- Info column -->
        <div
          id="info-col"
          class="section info-col"
          :style="infoColStyle"
        >
          <v-card class="flex-grow-1 h-100 d-flex flex-column">
            <v-tabs v-model="tab" show-arrows>
              <v-tab value="shots">Shots</v-tab>
              <v-tab value="selection">Selection</v-tab>
              <v-tab value="info">Info</v-tab>
            </v-tabs>

            <v-card-text class="flex-grow-1">
              <v-tabs-window v-model="tab" class="pa-4">
                <v-tabs-window-item id="shot-list-tab" value="shots">
                  <ShotList />
                </v-tabs-window-item>

                <v-tabs-window-item value="selection">
                  <ShotDetail />
                </v-tabs-window-item>

                <v-tabs-window-item value="info">
                  <p v-if="mainStore.fps">FPS: {{ mainStore.fps }}</p>
                </v-tabs-window-item>
              </v-tabs-window>
            </v-card-text>
          </v-card>
        </div>

        <!-- vertical separator (only visible in wide mode) -->
        <div
          class="separator vertical"
          ref="verticalSeparator"
          @mousedown="startVerticalDrag"
          @touchstart="handleTouchStart"
          :style="verticalSeparatorStyle"
        />
      </template>

      <!-- SINGLE‑COLUMN MODE (narrow) -->
      <template v-else>
        <!-- whichever pane is currently active -->
        <div
          v-if="showVideo"
          id="video-col"
          class="section video-col single"
          :style="singleColStyle"
        >
          <v-card class="flex-grow-1 h-100 d-flex flex-column">
            <VideoPlayer />
          </v-card>

          <!-- toggle button – show the *Info* pane -->
           <v-btn
            class="toggle-btn pa-2"
            @click="showVideo = false"
          >
            Switch to Info
            <v-icon icon="mdi-swap-horizontal" end></v-icon>
          </v-btn>
        </div>

        <div
          v-else
          id="info-col"
          class="section info-col single"
          :style="singleColStyle"
        >
          <v-card class="flex-grow-1 h-100 d-flex flex-column">
            <v-tabs v-model="tab" show-arrows>
              <v-tab value="shots">Shots</v-tab>
              <v-tab value="selection">Selection</v-tab>
              <v-tab value="info">Info</v-tab>
            </v-tabs>

            <v-card-text class="flex-grow-1">
              <v-tabs-window v-model="tab" class="pa-4">
                <v-tabs-window-item id="shot-list-tab" value="shots">
                  <ShotList />
                </v-tabs-window-item>

                <v-tabs-window-item value="selection">
                  <ShotDetail />
                </v-tabs-window-item>

                <v-tabs-window-item value="info">
                  <p v-if="mainStore.fps">FPS: {{ mainStore.fps }}</p>
                </v-tabs-window-item>
              </v-tabs-window>
            </v-card-text>
          </v-card>

          <!-- toggle button – show the *Video* pane -->
          <v-btn
            class="toggle-btn pa-2"
            @click="showVideo = true"
          >
            Switch to Video
            <v-icon icon="mdi-swap-horizontal" end></v-icon>
          </v-btn>
        </div>
      </template>

      <!-- ---------- BOTTOM AREA (Timelines) ---------- -->
      <div
        id="timelines"
        class="section timelines"
        :style="timelinesStyle"
      >
        <v-card class="flex-grow-1 h-100 d-flex flex-column">
          <v-card-text class="flex-grow-1">
            <Timelines />
          </v-card-text>
        </v-card>
      </div>

      <!-- Horizontal separator (always present) -->
      <div
        class="separator horizontal"
        ref="horizontalSeparator"
        @mousedown="startHorizontalDrag"
        @touchstart="handleTouchStart"
        :style="horizontalSeparatorStyle"
      />
    </div>
  </div>
</template>

<script>
import { mapStores } from 'pinia'
import ShotDetail from '@renderer/components/ShotDetail.vue'
import ShotList from '@renderer/components/ShotList.vue'
import Timelines from '@renderer/components/Timelines.vue'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'TilingManager',
  components: { ShotDetail, ShotList, Timelines, VideoPlayer },

  data() {
    return {
      tab: null,

      // layout percentages (same as the original component)
      verticalPosition: 50,
      horizontalPosition: 50,

      // drag state
      isDraggingVertical: false,
      isDraggingHorizontal: false,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,

      // UI messages (unchanged)
      statusMessage:
        'Drag the separators to adjust the layout proportions (minimum size)',
      warningMessage:
        'Warning: Sections cannot be smaller than minimum size',
      layoutInfo: '',

      // container dimensions
      containerWidth: 0,
      containerHeight: 0,

      // size constraints
      minComponentWidth: 400,
      minComponentHeight: 300,
      padding: '0.5rem',

      // ----- NEW STATE -------------------------------------------------
      // true → we have enough horizontal space for both columns
      // false → we are in the “single‑column” (narrow) mode
      isNarrow: false,

      // when we are in narrow mode, which column is currently visible?
      // true → video, false → info
      showVideo: true,
    }
  },

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    darkMode() {
      return this.$vuetify.theme.global.name === 'dark'
    },

    // -----------------------------------------------------------------
    //  Styles for the three sections – they adapt to narrow / wide mode
    // -----------------------------------------------------------------
    videoColStyle() {
      // wide mode (both columns visible)
      return {
        left: `calc(0% + ${this.padding})`,
        top: `calc(0% + ${this.padding})`,
        width: `calc(${this.verticalPosition}% - 2 * ${this.padding})`,
        height: `calc(${this.horizontalPosition}% - 2 * ${this.padding})`,
      }
    },

    infoColStyle() {
      // wide mode (both columns visible)
      return {
        left: `calc(${this.verticalPosition}% + ${this.padding})`,
        top: `calc(0% + ${this.padding})`,
        width: `calc(${100 - this.verticalPosition}% - 2 * ${this.padding})`,
        height: `calc(${this.horizontalPosition}% - 2 * ${this.padding})`,
      }
    },

    // style used for the *single* column (wide = 100% of the container)
    singleColStyle() {
      return {
        left: `calc(${this.padding})`,
        top: `calc(${this.padding})`,
        width: `calc(100% - 2 * ${this.padding})`,
        height: `calc(${this.horizontalPosition}% - 2 * ${this.padding})`,
      }
    },

    timelinesStyle() {
      return {
        left: `${this.padding}`,
        top: `calc(${this.horizontalPosition}% + ${this.padding})`,
        width: `calc(100% - 2 * ${this.padding})`,
        height: `${100 - this.horizontalPosition}%`,
      }
    },

    verticalSeparatorStyle() {
      return {
        top: `calc(${this.horizontalPosition}% / 2 - 5%)`,
        height: `10%`,
        background: this.darkMode ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
      }
    },

    horizontalSeparatorStyle() {
      return {
        top: `${this.horizontalPosition}%`,
        left: `45%`,
        width: `10%`,
        background: this.darkMode ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
      }
    },
  },

  mounted() {
    this.updateContainerSize()
    window.addEventListener('resize', this.handleResize)
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mouseup', this.stopDragging)
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false })
    document.addEventListener('touchend', this.stopDragging)

    // initial evaluation – the app may start already narrow
    this.evaluateNarrow()
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.stopDragging)
    document.removeEventListener('touchmove', this.handleTouchMove)
    document.removeEventListener('touchend', this.stopDragging)
  },

  methods: {
    // -----------------------------------------------------------------
    //  Drag handling – exactly the same as the original component
    // -----------------------------------------------------------------
    startVerticalDrag(e) {
      this.isDraggingVertical = true
      this.startX = e.clientX
      this.startLeft = this.verticalPosition
      this.statusMessage = 'Adjusting width ratio...'
      e.preventDefault()
    },

    startHorizontalDrag(e) {
      this.isDraggingHorizontal = true
      this.startY = e.clientY
      this.startTop = this.horizontalPosition
      this.statusMessage = 'Adjusting height ratio...'
      e.preventDefault()
    },

    handleMouseMove(e) {
      if (this.isDraggingVertical) this.dragVertical(e)
      else if (this.isDraggingHorizontal) this.dragHorizontal(e)
    },

    dragVertical(e) {
      const diff = e.clientX - this.startX
      const containerWidth =
        this.containerWidth || this.$refs.gridContainer.offsetWidth

      let newPos = this.startLeft + (diff / containerWidth) * 100
      newPos = this.constrainVerticalPosition(newPos)

      this.verticalPosition = newPos
      this.statusMessage = `Vertical separator at ${Math.round(newPos)}%`
    },

    dragHorizontal(e) {
      const diff = e.clientY - this.startY
      const containerHeight =
        this.containerHeight || this.$refs.gridContainer.offsetHeight

      let newPos = this.startTop + (diff / containerHeight) * 100
      newPos = this.constrainHorizontalPosition(newPos)

      this.horizontalPosition = newPos
      this.statusMessage = `Horizontal separator at ${Math.round(newPos)}%`
    },

    stopDragging() {
      this.isDraggingVertical = false
      this.isDraggingHorizontal = false
      this.statusMessage =
        'Drag the separators to adjust the layout proportions (minimum size)'
    },

    handleTouchStart(e) {
      if (
        e.target === this.$refs.verticalSeparator ||
        (e.target.parentElement &&
          e.target.parentElement === this.$refs.verticalSeparator)
      ) {
        this.startVerticalDrag(e.touches[0])
      } else if (
        e.target === this.$refs.horizontalSeparator ||
        (e.target.parentElement &&
          e.target.parentElement === this.$refs.horizontalSeparator)
      ) {
        this.startHorizontalDrag(e.touches[0])
      }
    },

    handleTouchMove(e) {
      if (this.isDraggingVertical || this.isDraggingHorizontal) {
        e.preventDefault()
        this.handleMouseMove(e.touches[0])
      }
    },

    constrainVerticalPosition(position) {
      const minPx = this.minComponentWidth
      const containerWidth =
        this.containerWidth || this.$refs.gridContainer.offsetWidth
      const minPct = (minPx / containerWidth) * 100

      if (position < minPct) {
        return minPct
      }

      const maxPct = 100 - minPct
      if (position > maxPct) {
        return maxPct
      }

      return position
    },

    constrainHorizontalPosition(position) {
      const minPx = this.minComponentHeight
      const containerHeight =
        this.containerHeight || this.$refs.gridContainer.offsetHeight
      const minPct = (minPx / containerHeight) * 100

      if (position < minPct) {
        return minPct
      }

      const maxPct = 100 - minPct
      if (position > maxPct) {
        return maxPct
      }

      return position
    },

    // -----------------------------------------------------------------
    //  Resize handling – we also decide whether we need the narrow mode
    // -----------------------------------------------------------------
    handleResize() {
      this.updateContainerSize()
      this.evaluateNarrow()
    },

    updateContainerSize() {
      if (this.$refs.gridContainer) {
        this.containerWidth = this.$refs.gridContainer.offsetWidth
        this.containerHeight = this.$refs.gridContainer.offsetHeight
      }
    },

    // -----------------------------------------------------------------
    //  Decide if we have enough horizontal space for both columns.
    //  If not, we go into “single‑column” mode.
    // -----------------------------------------------------------------
    evaluateNarrow() {
      const needed = this.minComponentWidth * 2 // two columns side‑by‑side
      this.isNarrow = this.containerWidth < needed

      // When we just entered narrow mode we keep the column that was
      // visible before the switch (default = video). When we exit narrow
      // mode we simply show both columns again.
    },

    // -----------------------------------------------------------------
    //  The mouse‑move listener used by the drag handlers
    // -----------------------------------------------------------------
    handleMouseMove(e) {
      if (this.isDraggingVertical) this.dragVertical(e)
      else if (this.isDraggingHorizontal) this.dragHorizontal(e)
    },
  },

  watch: {
    // keep the external separator elements in sync with the percentages
    verticalPosition() {
      if (this.$refs.verticalSeparator) {
        this.$refs.verticalSeparator.style.left = `${this.verticalPosition}%`
      }
    },
    horizontalPosition() {
      if (this.$refs.horizontalSeparator) {
        this.$refs.horizontalSeparator.style.top = `${this.horizontalPosition}%`
      }
    },
  },
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.tiling-manager {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.grid-container {
  position: relative;
  flex-grow: 1;
  overflow-y: hidden;
  overflow-x: hidden;
  min-height: 500px;
}

.section {
  position: absolute;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(5px);
}

.section.single {
  z-index: 2;
}

.separator {
  position: absolute;
  background: rgb(255, 255, 255);
  transition: background 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
}

/* vertical separator – between video and info columns */
.separator.vertical {
  width: 8px;
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
  cursor: ew-resize;
}

/* horizontal separator – between top and bottom sections */
.separator.horizontal {
  width: 100%;
  height: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ns-resize;
}

.separator:not(:hover) {
  opacity: 0.2;
}

.separator:hover {
  opacity: 0.7;
}

.toggle-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 5;
}

/* Vuetify overrides – make cards fill their container */
.v-card {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
.v-card-text {
  flex-grow: 1;
  overflow: auto;
}

@media (max-width: 768px) {
  .grid-container {
    min-height: 400px;
  }
}
</style>