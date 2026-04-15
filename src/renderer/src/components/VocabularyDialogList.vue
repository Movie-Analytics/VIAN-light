<template>
  <v-container>
    <v-row>
      <v-col>
        <v-list active-class="v-list-item--active">
          <VocabularyDialogListItem
            v-for="item in items"
            :key="item.id"
            :item="item"
            :is-editing="item.id === vocabularyId"
            :is-selected="item.id === selectedVocabularyId"
            show-export
            @edit="startEdit('vocabulary', item.id)"
            @save="saveEdit"
            @cancel="cancelEdit"
            @export="exportToFile"
            @delete="deleteItem(item.id)"
            @select="select('vocabulary', item)"
          />

          <v-list-item
            :title="
              $t('components.vocabularyDialogList.add', {
                itemType: $t('components.vocabularyDialogList.types.vocabulary')
              })
            "
            prepend-icon="mdi-plus"
            @click="addVocabulary"
          />
        </v-list>
      </v-col>

      <v-col v-if="selectedVocabularyId">
        <v-list active-class="v-list-item--active">
          <VocabularyDialogListItem
            v-for="item in selectedVocabulary.categories"
            :key="item.id"
            :item="item"
            :is-editing="item.id === categoryId"
            :is-selected="item.id === selectedCategoryId"
            @edit="startEdit('category', item.id)"
            @save="saveEdit"
            @cancel="cancelEdit"
            @delete="deleteItem(item.id)"
            @select="select('category', item)"
          />

          <v-list-item
            :title="
              $t('components.vocabularyDialogList.add', {
                itemType: $t('components.vocabularyDialogList.types.category')
              })
            "
            prepend-icon="mdi-plus"
            @click="addCategory"
          />
        </v-list>
      </v-col>

      <v-spacer v-else></v-spacer>
    </v-row>
  </v-container>
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
    items: { type: Array, required: true }
  },

  data() {
    return {
      categoryId: null,
      selectedCategory: null,
      selectedCategoryId: null,
      selectedVocabulary: null,
      selectedVocabularyId: null,
      vocabularyId: null
    }
  },

  computed: {
    ...mapStores(useUndoableStore)
  },

  methods: {
    addCategory() {
      const itemType = this.$t('components.vocabularyDialogList.types.category')
      this.categoryId = this.undoableStore.vocabularyAdd(
        this.selectedVocabularyId,
        this.$t('components.vocabularyDialogList.new', { itemType })
      )
    },

    addVocabulary() {
      const itemType = this.$t('components.vocabularyDialogList.types.vocabulary')
      this.vocabularyId = this.undoableStore.vocabularyAdd(
        this.id,
        this.$t('components.vocabularyDialogList.new', { itemType })
      )
    },

    cancelEdit() {
      this.vocabularyId = null
      this.categoryId = null
    },

    deleteItem(id) {
      this.undoableStore.vocabularyDelete(id)
    },

    exportToFile(id) {
      exportVocabJson(this.undoableStore.vocabularies.find((v) => v.id === id))
    },

    saveEdit(newName) {
      if (this.vocabularyId) {
        this.undoableStore.vocabularyRename(this.vocabularyId, newName)
      } else if (this.categoryId) {
        this.undoableStore.vocabularyRename(this.categoryId, newName)
      }
      this.cancelEdit()
    },

    select(itemType, item) {
      if (itemType === 'vocabulary') {
        this.selectedVocabularyId = item.id
        this.selectedVocabulary = item
      } else if (itemType === 'category') {
        this.selectedCategoryId = item.id
        this.selectedCategory = item
      }
    },

    startEdit(itemType, id) {
      if (itemType === 'vocabulary') {
        this.vocabularyId = id
      } else if (itemType === 'category') {
        this.categoryId = id
      }
    }
  }
}
</script>
