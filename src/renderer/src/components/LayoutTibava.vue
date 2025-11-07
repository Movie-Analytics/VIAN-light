<template>
  <div class="tiling-manager">
    <div class="grid-container" ref="gridContainer">
      <!-- Video Column -->
      <div 
        id="video-col" 
        class="section video-col" 
        :style="videoColStyle"
      >
        <v-card class="flex-grow-1 h-100 d-flex flex-column">
          <!-- <div class="video-player-wrapper"> -->
            <VideoPlayer></VideoPlayer>
          <!-- </div> -->
        </v-card>
      </div>

      <!-- Info Column -->
      <div 
        id="info-col" 
        class="section info-col" 
        :style="infoColStyle"
      >
        <v-card class="flex-grow-1 h-100 d-flex flex-column">
          <v-tabs v-model="tab" show-arrows>
            <!-- <v-tab :disabled="undoableStore.shotTimelines.length == 0" value="shots">Shots</v-tab> -->
            <v-tab value="shots">Shots</v-tab>
            <v-tab value="selection">Selection</v-tab>
            <v-tab value="info">Info</v-tab>
          </v-tabs>

          <v-card-text class="flex-grow-1">
            <v-tabs-window v-model="tab" class="pa-4">

              <v-tabs-window-item id="shot-list-tab" value="shots">
                <ShotList></ShotList>
              </v-tabs-window-item>

              <v-tabs-window-item value="selection">
                <ShotDetail></ShotDetail>
              </v-tabs-window-item>

              <v-tabs-window-item value="info">
                <p v-if="mainStore.fps">FPS: {{ mainStore.fps }}</p>
              </v-tabs-window-item>
            </v-tabs-window>
          </v-card-text>
        </v-card>
      </div>

      <!-- Timelines -->
      <div 
        id="timelines" 
        class="section timelines" 
        :style="timelinesStyle"
      >
        <v-card class="flex-grow-1 h-100 d-flex flex-column">
          <v-card-text class="flex-grow-1">
            <Timelines></Timelines>
          </v-card-text>
        </v-card>
      </div>

      <!-- Draggable Separators -->
      <!-- Vertical separator between video and info columns -->
      <div 
        class="separator vertical" 
        ref="verticalSeparator"
        @mousedown="startVerticalDrag"
        @touchstart="handleTouchStart"
        :style="verticalSeparatorStyle"
      >
      </div>
      
      <!-- Horizontal separator between top and bottom sections -->
      <div 
        class="separator horizontal" 
        ref="horizontalSeparator"
        @mousedown="startHorizontalDrag"
        @touchstart="handleTouchStart"
        :style="horizontalSeparatorStyle"
      >
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
  components: { 
    ShotDetail, 
    ShotList, 
    Timelines, 
    VideoPlayer 
  },
  data() {
    return {
      tab: null,
      verticalPosition: 50,
      horizontalPosition: 50,
      isDraggingVertical: false,
      isDraggingHorizontal: false,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      statusMessage: "Drag the separators to adjust the layout proportions (minimum 25% size)",
      warningMessage: "Warning: Sections cannot be smaller than 25% of the container size",
      layoutInfo: "",
      containerWidth: 0,
      containerHeight: 0,
      padding: "0.5rem"
    }
  },
  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    darkMode() {
      return this.$vuetify.theme.global.name === 'dark'
    },
    
    videoColStyle() {
      return {
        left: `calc(0% + ${this.padding})`,
        top: `calc(0% + ${this.padding})`,
        width: `calc(${this.verticalPosition}% - 2 * ${this.padding})`,
        height: `calc(${this.horizontalPosition}% - 2 * ${this.padding})`,
      }
    },
    infoColStyle() {
      return {
        left: `calc(${this.verticalPosition}% + ${this.padding})`,
        top: `calc(0% + ${this.padding})`,
        width: `calc(${100 - this.verticalPosition}% - 2 * ${this.padding})`,
        height: `calc(${this.horizontalPosition}% - 2 * ${this.padding})`,
      }
    },
    timelinesStyle() {
      return {
        left: `${this.padding}`,
        top: `calc(${this.horizontalPosition}% + ${this.padding})`,
        width: `calc(100% - 2 * ${this.padding})`,
        height: `${100 - this.horizontalPosition}%`
      }
    },
    verticalSeparatorStyle() {
      return {
        // top: `${this.padding}`,
        // height: `calc(${this.horizontalPosition}% - 2 * ${this.padding}`,
        top: `calc(${this.horizontalPosition}% / 2 - 5%)`,
        height: `10%`,
        // TODO: Use theme colors
        background: this.darkMode ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)",
      }
    },
    horizontalSeparatorStyle() {
      console.log(this.darkMode) 

      return {
        top: `${this.horizontalPosition}%`,
        // left: `${this.padding}`,
        // width: `calc(100% - 2 * ${this.padding})`,
        left: `45%`,
        width: `10%`,
        // TODO: Use theme colors
        background: this.darkMode ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)",
      }
    }
  },
  mounted() {
    this.updateContainerSize();
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.stopDragging);
    document.addEventListener('touchmove', this.handleTouchMove);
    document.addEventListener('touchend', this.stopDragging);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.stopDragging);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.stopDragging);
  },
  methods: {
    startVerticalDrag(e) {
      this.isDraggingVertical = true;
      this.startX = e.clientX;
      this.startLeft = this.verticalPosition;
      this.statusMessage = "Adjusting width ratio...";
      e.preventDefault();
    },
    
    startHorizontalDrag(e) {
      this.isDraggingHorizontal = true;
      this.startY = e.clientY;
      this.startTop = this.horizontalPosition ;
      this.statusMessage = "Adjusting height ratio...";
      e.preventDefault();
    },
    
    handleMouseMove(e) {
      if (this.isDraggingVertical) {
        this.dragVertical(e);
      } else if (this.isDraggingHorizontal) {
        this.dragHorizontal(e);
      }
    },
    
    dragVertical(e) {
      const diff = e.clientX - this.startX;
      const containerWidth = this.containerWidth || this.$refs.gridContainer.offsetWidth;
      
      // Calculate new position (0-100%)
      let newPosition = this.startLeft + (diff / containerWidth) * 100;
      
      // Apply minimum size constraints
      newPosition = this.constrainVerticalPosition(newPosition);
      
      // Update position
      this.verticalPosition = newPosition;
      this.statusMessage = `Vertical separator at ${Math.round(newPosition)}%`;
    },
    
    dragHorizontal(e) {
      const diff = e.clientY - this.startY;
      const containerHeight = this.containerHeight || this.$refs.gridContainer.offsetHeight;
      
      // Calculate new position (0-100%)
      let newPosition = this.startTop + (diff / containerHeight) * 100;
      
      // Apply minimum size constraints
      newPosition = this.constrainHorizontalPosition(newPosition);
      
      // Update position
      this.horizontalPosition = newPosition;
      this.statusMessage = `Horizontal separator at ${Math.round(newPosition)}%`;
    },
    
    stopDragging() {
      this.isDraggingVertical = false;
      this.isDraggingHorizontal = false;
      this.statusMessage = "Drag the separators to adjust the layout proportions (minimum 25% size)";
    },
    
    handleTouchStart(e) {
      if (e.target === this.$refs.verticalSeparator || 
          (e.target.parentElement && e.target.parentElement === this.$refs.verticalSeparator)) {
        this.startVerticalDrag(e.touches[0]);
      } else if (e.target === this.$refs.horizontalSeparator || 
                 (e.target.parentElement && e.target.parentElement === this.$refs.horizontalSeparator)) {
        this.startHorizontalDrag(e.touches[0]);
      }
    },
    
    handleTouchMove(e) {
      if (this.isDraggingVertical || this.isDraggingHorizontal) {
        e.preventDefault();
        this.handleMouseMove(e.touches[0]);
      }
    },
    
    constrainVerticalPosition(position) {
      // Minimum 25% for video column
      const minVideo = 25;
      // Maximum 75% for info column (so it's at least 25%)
      const maxInfo = 75;
      
      // Ensure we don't go below minimum
      if (position < minVideo) {
        this.warningMessage = "Warning: Video Column cannot be smaller than 25%";
        setTimeout(() => {
          this.warningMessage = "Warning: Sections cannot be smaller than 25% of the container size";
        }, 2000);
        return minVideo;
      }
      
      // Ensure we don't go above maximum
      if (position > maxInfo) {
        this.warningMessage = "Warning: Info Column cannot be smaller than 25%";
        setTimeout(() => {
          this.warningMessage = "Warning: Sections cannot be smaller than 25% of the container size";
        }, 2000);
        return maxInfo;
      }
      
      this.warningMessage = "Warning: Sections cannot be smaller than 25% of the container size";
      return position;
    },
    
    constrainHorizontalPosition(position) {
      // Minimum 25% for top sections
      const minTop = 25;
      // Maximum 75% for bottom section (so it's at least 25%)
      const maxBottom = 75;
      
      // Ensure we don't go below minimum
      if (position < minTop) {
        this.warningMessage = "Warning: Top sections cannot be smaller than 25%";
        setTimeout(() => {
          this.warningMessage = "Warning: Sections cannot be smaller than 25% of the container size";
        }, 2000);
        return minTop;
      }
      
      // Ensure we don't go above maximum
      if (position > maxBottom) {
        this.warningMessage = "Warning: Timelines cannot be smaller than 25%";
        setTimeout(() => {
          this.warningMessage = "Warning: Sections cannot be smaller than 25% of the container size";
        }, 2000);
        return maxBottom;
      }
      
      this.warningMessage = "Warning: Sections cannot be smaller than 25% of the container size";
      return position;
    },
    
    handleResize() {
      this.updateContainerSize();
    },
    
    updateContainerSize() {
      if (this.$refs.gridContainer) {
        this.containerWidth = this.$refs.gridContainer.offsetWidth;
        this.containerHeight = this.$refs.gridContainer.offsetHeight;
      }
    }
  },
  watch: {
    // Update separator positions when layout changes
    verticalPosition() {
      if (this.$refs.verticalSeparator) {
        this.$refs.verticalSeparator.style.left = `${this.verticalPosition}%`;
      }
    },
    horizontalPosition() {
      if (this.$refs.horizontalSeparator) {
        this.$refs.horizontalSeparator.style.top = `${this.horizontalPosition}%`;
      }
    }
  }
}
</script>

<style scoped>
* {
  margin: 5;
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
  /* background: rgba(0, 0, 0, 0.05); */
  /* border-radius: 10px; */
  overflow: hidden;
  min-height: 500px;
}

.section {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin: 0;
  transform: none !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(5px);
  overflow: vis;
  /* border: 1px solid rgba(255, 255, 255, 0.2); */
}

/* Separator styles */
.separator {
  position: absolute;
  background: rgba(255, 255, 255);
  transition: background 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  /* box-shadow: 0 0 5px rgba(0, 0, 0, 0.2); */
  border-radius: 4px;
}

/* Vertical separator - between video and info columns */
.separator.vertical {
  width: 8px;
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
  cursor: ew-resize;
}

/* Horizontal separator - between top and bottom sections */
.separator.horizontal {
  width: 100%;
  height: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ns-resize;
}

/* Hide separators when not hovering */
.separator:not(:hover) {
  opacity: 0.2;
}

/* Show separators when hovering */
.separator:hover {
  opacity: 0.7;
}

/* Override Vuetify styles for proper sizing */
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

/* Responsive adjustments */
@media (max-width: 768px) {
  .grid-container {
    min-height: 400px;
  }
}
</style>