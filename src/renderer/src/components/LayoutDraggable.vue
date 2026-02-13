<template>
  <div class="px-5">
    <LayoutDraggableItem v-for="item in items" :key="item.title" v-bind="item" @dragged="onDragged">
      <component :is="item.component"></component>
    </LayoutDraggableItem>
  </div>
</template>

<script>
import LayoutDraggableItem from '@renderer/components/LayoutDraggableItem.vue'
import ShotDetail from '@renderer/components/ShotDetail.vue'
import ShotList from '@renderer/components/ShotList.vue'
import Timelines from '@renderer/components/Timelines.vue'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'

export default {
  name: 'LayoutDraggable',
  components: { LayoutDraggableItem, ShotDetail, ShotList, Timelines, VideoPlayer },

  data() {
    return {
      items: [
        {
          component: 'VideoPlayer',
          heightInitial: 450,
          title: this.$t('components.layout.player'),
          widthInitial: 500,
          xInitial: 10,
          yInitial: 70,
          z: 0
        },
        {
          component: 'ShotList',
          heightInitial: 450,
          title: this.$t('components.layout.shotList'),
          widthInitial: 400,
          xInitial: 550,
          yInitial: 70,
          z: 1
        },
        {
          component: 'Timelines',
          heightInitial: 400,
          title: this.$t('components.layout.timelines'),
          widthInitial: 500,
          xInitial: 10,
          yInitial: 550,
          z: 2
        },
        {
          component: 'ShotDetail',
          heightInitial: 400,
          title: this.$t('components.layout.shotDetails'),
          widthInitial: 400,
          xInitial: 550,
          yInitial: 550,
          z: 3
        }
      ]
    }
  },

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
