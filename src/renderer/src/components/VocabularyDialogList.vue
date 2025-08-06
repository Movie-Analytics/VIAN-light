<template>
  <v-list>
    <template v-if="isHierarchical">
      <v-list-group v-for="item in items" :key="item.id" :value="item.id">
        <template #activator="{ props }">
          <VocabularyDialogListItem
            :style="{ 'margin-start': indent }"
            v-bind="props"
            :item="item"
            :is-editing="item.id === editingId"
            :show-export="level === 1"
            @edit="startEdit"
            @save="saveEdit"
            @cancel="cancelEdit"
            @export="exportToFile"
            @delete="deleteItem(item.id)"
          />
        </template>

        <vocabulary-dialog-list
          :id="item.id"
          :items="item.categories || item.tags"
          :level="level + 1"
          @export="$emit('export', $event)"
        />
      </v-list-group>
    </template>

    <template v-else>
      <VocabularyDialogListItem
        v-for="item in items"
        :key="item.id"
        :style="{ 'margin-start': indent }"
        :item="item"
        :is-editing="item.id === editingId"
        @edit="startEdit"
        @save="saveEdit"
        @cancel="cancelEdit"
        @delete="deleteItem(item.id)"
      />
    </template>

    <v-list-item
      :style="{ 'margin-start': indent }"
      :title="`Add ${itemType}`"
      prepend-icon="mdi-plus"
      @click="addItem"
    />
  </v-list>
</template>

<script>
import { exportVocabJson } from '@renderer/importexport'
import { mapStores } from 'pinia'
import { useUndoableStore } from '@renderer/stores/undoable'

import VocabularyDialogListItem from '@renderer/components/VocabularyDialogListItem.vue'

export default {
  name: 'VocabularyDialogList',
  components: { VocabularyDialogListItem },

  props: {
    id: { type: [String, null], required: true },
    items: { type: Array, required: true },
    level: { type: Number, required: true }
  },

  emits: ['export'],

  data() {
    return {
      editingId: null
    }
  },

  computed: {
    ...mapStores(useUndoableStore),

    indent() {
      return (this.level - 1) * 30 + 'px'
    },

    isHierarchical() {
      return this.level < 3
    },

    itemType() {
      const types = { 1: 'vocabulary', 2: 'category', 3: 'tag' }
      return types[this.level]
    }
  },

  methods: {
    addItem() {
      this.editingId = this.undoableStore.vocabularyAdd(this.id, 'New ' + this.itemType)
    },

    cancelEdit() {
      this.editingId = null
    },

    deleteItem(id) {
      this.undoableStore.vocabularyDelete(id)
    },

    exportToFile(id) {
      exportVocabJson(this.undoableStore.vocabularies.find((v) => v.id === id))
    },

    saveEdit(newName) {
      this.undoableStore.vocabularyRename(this.editingId, newName)
      this.cancelEdit()
    },

    startEdit(id) {
      this.editingId = id
    }
  }
}
</script>
