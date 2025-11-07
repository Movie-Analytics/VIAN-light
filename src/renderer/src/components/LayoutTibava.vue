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
          <VideoPlayer></VideoPlayer>
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
            <v-tab value="info">Info</v-tab>
            <v-tab :disabled="undoableStore.shotTimelines.length == 0" value="shots">Shots</v-tab>
            <v-tab value="selection">Selection</v-tab>
          </v-tabs>

          <v-card-text class="flex-grow-1">
            <v-tabs-window v-model="tab">
              <v-tabs-window-item value="info">
                <p v-if="mainStore.fps">FPS: {{ mainStore.fps }}</p>
              </v-tabs-window-item>

              <v-tabs-window-item id="shot-list-tab" value="shots" class="h-100 overflow-y-auto">
                <ShotList></ShotList>
              </v-tabs-window-item>

              <v-tabs-window-item value="selection">
                <ShotDetail></ShotDetail>
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
      <div 
        class="separator vertical" 
        ref="verticalSeparator"
        @mousedown="startVerticalDrag"
        @touchstart="handleTouchStart"
      >
        <div class="separator-handle"></div>
      </div>
      
      <div 
        class="separator horizontal" 
        ref="horizontalSeparator"
        @mousedown="startHorizontalDrag"
        @touchstart="handleTouchStart"
      >
        <div class="separator-handle"></div>
      </div>
    </div>
    
    <!-- <div class="status-bar">
      {{ statusMessage }}
    </div>
    
    <div class="layout-info">
      Current layout: 
      <span v-html="layoutInfo"></span>
    </div>
    
    <div class="min-size-warning">
      {{ warningMessage }}
    </div> -->
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
      containerHeight: 0
    }
  },
  computed: {
    ...mapStores(useMainStore, useUndoableStore),
    videoColStyle() {
      return {
        left: '0%',
        top: '0%',
        width: `${this.verticalPosition}%`,
        height: `${this.horizontalPosition}%`
      }
    },
    infoColStyle() {
      return {
        left: `${this.verticalPosition}%`,
        top: '0%',
        width: `${100 - this.verticalPosition}%`,
        height: `${this.horizontalPosition}%`
      }
    },
    timelinesStyle() {
      return {
        left: '0%',
        top: `${this.horizontalPosition}%`,
        width: '100%',
        height: `${100 - this.horizontalPosition}%`
      }
    }
  },
  mounted() {
    this.updateContainerSize();
    this.updateLayoutInfo();
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
      this.startTop = this.horizontalPosition;
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
      this.updateLayoutInfo();
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
      this.updateLayoutInfo();
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
    
    updateLayoutInfo() {
      const videoWidth = this.verticalPosition;
      const infoWidth = 100 - this.verticalPosition;
      const topHeight = this.horizontalPosition;
      const bottomHeight = 100 - this.horizontalPosition;
      
      this.layoutInfo = `
        Video Column: (0,0)-(${Math.round(videoWidth)}%,${Math.round(topHeight)}%)<br>
        Info Column: (${Math.round(videoWidth)}%,0)-(${Math.round(100)}%,${Math.round(topHeight)}%)<br>
        Timelines: (0,${Math.round(topHeight)}%)-(${Math.round(100)}%,${Math.round(100)}%)
      `;
    },
    
    handleResize() {
      this.updateContainerSize();
      this.updateLayoutInfo();
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
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  min-height: 500px;
}

.section {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.section:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-3px);
}

.video-col {
  background: linear-gradient(135deg, #3498db, #8e44ad);
}

.info-col {
  background: linear-gradient(135deg, #2ecc71, #f1c40f);
}

.timelines {
  background: linear-gradient(135deg, #e74c3c, #d35400);
}

/* Separator styles */
.separator {
  position: absolute;
  z-index: 100;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.separator:hover {
  background: rgba(255, 255, 255, 0.6);
}

.separator.vertical {
  width: 8px;
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
}

.separator.horizontal {
  width: 100%;
  height: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.separator-handle {
  width: 30px;
  height: 30px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  z-index: 101;
}

.separator:hover .separator-handle {
  opacity: 1;
}

.separator-handle::before {
  content: "";
  width: 12px;
  height: 12px;
  background: #333;
  border-radius: 50%;
}

.status-bar {
  margin-top: 20px;
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  font-size: 1.1rem;
}

.layout-info {
  margin-top: 15px;
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  font-size: 1rem;
}

.min-size-warning {
  margin-top: 10px;
  color: #ffcc00;
  font-weight: bold;
  text-align: center;
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

/* Fix for separator visibility */
.separator {
  pointer-events: auto;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .grid-container {
    min-height: 400px;
  }
  
  .status-bar, .layout-info, .min-size-warning {
    font-size: 0.9rem;
  }
}
</style>