<template>
  <v-sheet class="d-flex flex-1-1 flex-column h-100 height-min-0">
    <v-row class="flex-0-0 ma-1">
      <v-select
        v-model="shotTimeline"
        :items="undoableStore.shotTimelines"
        :label="$t('components.shotList.selectTrack')"
        class="me-2 shotlist-header-element"
        item-title="name"
        item-value="id"
      />

      <v-select
        v-model="screenshotTimeline"
        :items="undoableStore.screenshotTimelines"
        :label="$t('components.shotList.screenshotTimeline')"
        class="shotlist-header-element"
        item-title="name"
        item-value="id"
      />

      <v-slider
        v-model="thumbZoom"
        :disabled="!screenshotTimeline"
        append-icon="mdi-magnify-plus-outline"
        prepend-icon="mdi-magnify-minus-outline"
        class="ma-2 shotlist-header-element"
        hide-details
        :min="30"
        :max="100"
      ></v-slider>
    </v-row>

    <div id="virtualscroll-containerx" class="flex-1-1 height-min-0 overflow-y-auto">
      <v-virtual-scroll v-if="shotTimeline" :items="shots">
        <template #default="{ item, index }">
          <div class="pa-3" :class="getEntryBgColor(item)">
            <div class="cursor-pointer" @click="jumpPlayer(item.start)">
              <span class="font-weight-bold">
                {{ $t('components.shotList.id') }} {{ index + 1 }}
              </span>

              <span class="text-medium-emphasis">
                ({{ mainStore.timeReadableFrame(item.start) }} -
                {{ mainStore.timeReadableFrame(item.end) }})
              </span>
            </div>

            <div>
              <p>
                <span> {{ $t('components.shotList.annotation') }}: {{ item.annotation }} </span>
              </p>
            </div>

            <v-row v-if="screenshotTimeline" justify="start" class="ga-3 mx-3 py-3">
              <img
                v-for="img in getShotImages(item)"
                :key="img.id"
                :src="img.image"
                :style="thumbZoomStyle"
                loading="lazy"
                @click="imageClicked(img)"
              />
            </v-row>
          </div>
        </template>
      </v-virtual-scroll>
    </div>

    <ImageDialog ref="imageDialog"></ImageDialog>
  </v-sheet>
</template>
