<template>
  <div class="tiling-manager">
    <div class="grid-container" ref="gridContainer">

      <!-- ---------- Video Row ---------- -->
      <div
        id="video-col"
        class="section video-col"
        :style="videoStyle"
      >
        <v-card class="flex-grow-1 h-100 d-flex flex-column">
          <VideoPlayer />
        </v-card>
      </div>

      <!-- ---------- Info Row ---------- -->
      <div
        id="info-col"
        class="section info-col"
        :style="infoStyle"
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

      <!-- ---------- Timelines Row ---------- -->
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

      <!-- ---------- Separators (siblings of the sections) ---------- -->

      <!-- Separator between Video & Info (index 0) -->
      <div
        class="separator horizontal"
        ref="sep0"
        @mousedown="startDrag(0, $event)"
        @touchstart="startDrag(0, $event.touches[0])"
        :style="separatorStyle(0)"
      >
        <div class="line" :style="{ background: separatorColor }" />
        <v-icon
          class="sep-icon"
          @click.stop="toggleCollapse(0)"
          :icon="collapsed[0] ? 'mdi-chevron-down' : 'mdi-chevron-up'"
        />
      </div>

      <!-- Separator between Info & Timelines (index 1) -->
      <div
        class="separator horizontal"
        ref="sep1"
        @mousedown="startDrag(1, $event)"
        @touchstart="startDrag(1, $event.touches[0])"
        :style="separatorStyle(1)"
      >
        <div class="line" :style="{ background: separatorColor }" />
        <v-icon
          class="sep-icon"
          @click.stop="toggleCollapse(1)"
          :icon="collapsed[1] ? 'mdi-chevron-down' : 'mdi-chevron-up'"
        />
      </div>

      <!-- Bottom separator of the Timelines pane (index 2) – no button -->
      <div
        class="separator horizontal"
        ref="sep2"
        @mousedown="startDrag(2, $event)"
        @touchstart="startDrag(2, $event.touches[0])"
        :style="separatorStyle(2)"
      >
        <div class="line" :style="{ background: separatorColor }" />
      </div>

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

      // heights (px) of the three rows
      videoHeight: 300,
      infoHeight: 300,
      timelinesHeight: 300,

      // collapse handling – only Video & Info have manual buttons now
      collapsed: [false, false],
      previousHeights: [300, 300],          // remember height before manual collapse

      // remember the height of the Timelines pane before it auto‑collapses
      previousTimelinesHeight: 300,

      // dragging helpers (0 = video, 1 = info, 2 = timelines)
      dragging: false,
      dragIndex: null,
      startY: 0,
      startHeight: 0,

      // constants
      minComponentHeight: 200,
      separatorThickness: 24, // draggable area height (kept larger for ease)
      padding: '1rem',        // more inner padding for the content
    }
  },

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    darkMode() {
      return this.$vuetify.theme.global.name === 'dark'
    },

    // colour of the thin line inside the separator
    separatorColor() {
      return this.darkMode ? '#fff' : '#000'
    },

    // -----------------------------------------------------------------
    //  Section styles – absolute positioning.  The top of a section
    //  includes the separator that sits **above** it.
    // -----------------------------------------------------------------
    videoStyle() {
      return {
        top: `calc(${this.padding})`,
        left: `calc(${this.padding})`,
        width: `calc(100% - 2 * ${this.padding})`,
        height: `${this.videoHeight}px`,
      }
    },

    infoStyle() {
      const top =
        parseFloat(this.padding) +               // top padding
        this.videoHeight +                       // video pane
        this.separatorThickness;                 // separator under video
      return {
        top: `${top}px`,
        left: `calc(${this.padding})`,
        width: `calc(100% - 2 * ${this.padding})`,
        height: `${this.infoHeight}px`,
      }
    },

    timelinesStyle() {
      const top =
        parseFloat(this.padding) +               // top padding
        this.videoHeight +                       // video pane
        this.separatorThickness +                // separator under video
        this.infoHeight +                        // info pane
        this.separatorThickness;                 // separator under info
      return {
        top: `${top}px`,
        left: `calc(${this.padding})`,
        width: `calc(100% - 2 * ${this.padding})`,
        height: `${this.timelinesHeight}px`,
      }
    },

    // -----------------------------------------------------------------
    //  Separator style – positioned absolutely in the container.
    //  The `index` tells us which separator we are styling:
    //   0 → between video & info
    //   1 → between info & timelines
    //   2 → bottom of timelines (no button)
    // -----------------------------------------------------------------
    separatorStyle() {
      // we expose a function so we can compute the `top` for each index
      return (index) => {
        let top = parseFloat(this.padding) // start after the top padding

        if (index === 0) {
          top += this.videoHeight
        } else if (index === 1) {
          top += this.videoHeight + this.separatorThickness + this.infoHeight
        } else if (index === 2) {
          top +=
            this.videoHeight +
            this.separatorThickness +
            this.infoHeight +
            this.separatorThickness +
            this.timelinesHeight
        }

        return {
          top: `${top}px`,
          left: `calc(${this.padding})`,
          width: `calc(100% - 2 * ${this.padding})`,
          height: `${this.separatorThickness}px`,
          background: 'transparent',
          cursor: 'ns-resize',
        }
      }
    },
  },

  mounted() {
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.stopDrag)
    document.addEventListener('touchmove', this.onTouchMove, { passive: false })
    document.addEventListener('touchend', this.stopDrag)
  },

  beforeDestroy() {
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.stopDrag)
    document.removeEventListener('touchmove', this.onTouchMove)
    document.removeEventListener('touchend', this.stopDrag)
  },

  methods: {
    // -----------------------------------------------------------------
    //  Drag handling – index 0 = video, 1 = info, 2 = timelines
    // -----------------------------------------------------------------
    startDrag(index, e) {
      // Prevent drag when the click originated from a collapse icon or the line
      if (e.target.closest('.sep-icon') || e.target.closest('.line')) return

      this.dragging = true
      this.dragIndex = index
      this.startY = e.clientY

      // remember the height of the pane we are about to resize
      if (index === 0) this.startHeight = this.videoHeight
      else if (index === 1) this.startHeight = this.infoHeight
      else this.startHeight = this.timelinesHeight

      e.preventDefault()
    },

    onMouseMove(e) {
      if (!this.dragging) return
      this.performDrag(e.clientY)
    },

    onTouchMove(e) {
      if (!this.dragging) return
      e.preventDefault()
      this.performDrag(e.touches[0].clientY)
    },

    performDrag(currentY) {
      const diff = currentY - this.startY
      let newHeight = this.startHeight + diff

      // enforce the global minimum
      const min = this.minComponentHeight
      if (newHeight < min) newHeight = min

      if (this.dragIndex === 0) {
        this.videoHeight = newHeight
      } else if (this.dragIndex === 1) {
        this.infoHeight = newHeight
      } else if (this.dragIndex === 2) {
        // Timelines – auto‑collapse when it would go below the minimum
        if (newHeight < min) {
          this.previousTimelinesHeight = this.timelinesHeight
          this.timelinesHeight = 0
        } else {
          this.timelinesHeight = newHeight
        }
      }
    },

    stopDrag() {
      this.dragging = false
      this.dragIndex = null
    },

    // -----------------------------------------------------------------
    //  Manual collapse/expand for Video & Info (kept from the previous
    //  version).  Timelines is now **auto‑collapsed**, so there is no
    //  button for it.
    // -----------------------------------------------------------------
    toggleCollapse(index) {
      const isCollapsed = this.collapsed[index]

      if (isCollapsed) {
        // expand – restore the height we stored before collapsing
        const restored = this.previousHeights[index] || this.minComponentHeight
        if (index === 0) this.videoHeight = restored
        else this.infoHeight = restored
        this.collapsed.splice(index, 1, false)
      } else {
        // collapse – store current height then set to 0
        if (index === 0) this.previousHeights[0] = this.videoHeight
        else this.previousHeights[1] = this.infoHeight

        if (index === 0) this.videoHeight = 0
        else this.infoHeight = 0

        this.collapsed.splice(index, 1, true)
      }
    },
  },

  // initialise the “previous heights” array once the component is created
  created() {
    this.previousHeights = [this.videoHeight, this.infoHeight]
  },
}
</script>

<style scoped>
/* --------------------------------------------------------------
   Global reset & basic layout
   -------------------------------------------------------------- */
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

/* The container scrolls vertically when the total height exceeds the
   viewport. */
.grid-container {
  position: relative;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 500px;
}

/* --------------------------------------------------------------
   Section (row) styling – now with a larger inner padding
   -------------------------------------------------------------- */
.section {
  position: absolute;
  left: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(5px);
  padding: 1rem;               /* more padding for the content */
}

/* --------------------------------------------------------------
   Separator styling – lives as a sibling of the sections.
   The visible part is the thin line (10 % width) plus (optionally)
   the collapse/expand icon for Video & Info.
   -------------------------------------------------------------- */
.separator {
  position: absolute;
  left: 0;
  display: flex;
  flex-direction: column;      /* line above icon */
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
  opacity: 0.2;                /* faint when idle */
}
.separator:hover {
  opacity: 0.7;                /* more visible on hover */
}

/* thin line (10 % of the container width) */
.line {
  width: 10%;
  height: 2px;
  margin-bottom: 4px;          /* space between line and icon */
}

/* Icon placed in the centre of the separator (only Video & Info) */
.sep-icon {
  font-size: 1.2rem;
  color: currentColor;         /* inherits the colour set on the line */
  cursor: pointer;
  padding: 4px;                /* larger hit‑area on touch devices */
  z-index: 2;                  /* sit above the drag area */
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

/* --------------------------------------------------------------
   Small responsive tweak
   -------------------------------------------------------------- */
@media (max-width: 768px) {
  .grid-container {
    min-height: 400px;
  }
}
</style>