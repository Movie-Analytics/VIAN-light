<template>
  <div class="px-5">
    <layout-draggable-item
      v-for="item in items"
      :key="item.title"
      v-bind="item"
      @dragged="onDragged"
    >
      <component :is="item.component"></component>
    </layout-draggable-item>
  </div>
</template>

<script>
import ShotDetail from '@renderer/components/ShotDetail.vue'
import ShotList from '@renderer/components/ShotList.vue'
import Timelines from '@renderer/components/Timelines.vue'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import LayoutDraggableItem from '@renderer/components/LayoutDraggableItem.vue'

export default {
  components: { LayoutDraggableItem, Timelines, VideoPlayer, ShotList, ShotDetail },
  data: () => ({
    zOrder: ['Player', 'Shot List', 'Shot Details', 'Timelines'],
    items: [
      {
        title: 'Player',
        xInitial: 10,
        yInitial: 70,
        widthInitial: 500,
        heightInitial: 450,
        component: 'VideoPlayer',
        z: 0
      },
      {
        title: 'Shot List',
        xInitial: 550,
        yInitial: 70,
        widthInitial: 400,
        heightInitial: 450,
        component: 'ShotList',
        z: 1
      },
      {
        title: 'Timelines',
        xInitial: 10,
        yInitial: 550,
        widthInitial: 500,
        heightInitial: 400,
        component: 'Timelines',
        z: 2
      },
      {
        title: 'Shot Details',
        xInitial: 550,
        yInitial: 550,
        widthInitial: 400,
        heightInitial: 400,
        component: 'ShotDetail',
        z: 3
      }
    ]
  }),
  methods: {
    onDragged(name) {
      const draggedItem = this.items.find((item) => item.title === name)
      const maxZ = Math.max(...this.items.map((item) => item.z))

      draggedItem.z = maxZ + 1

      this.items
        .sort((x, y) => x.z - y.z)
        .forEach((item, i) => {
          item.z = i
        })
    }
  }
}
</script>
