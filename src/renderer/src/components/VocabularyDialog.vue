<template>
  <v-dialog v-model="dialogShown" persistent max-width="400">
    <v-card>
      <v-card-title>Manage Vocabulary</v-card-title>

      <v-card-text>
        <v-list>
          <v-list-group v-for="vocab in vocabularies" :key="vocab.id" :value="vocab.id">
            <template #activator="{ props }">
              <v-list-item v-bind="props">
                <v-list-item-title v-if="vocab.id === editId">
                  <v-text-field
                    v-model="editModel"
                    density="compact"
                    @click.stop=""
                    @keydown.stop=""
                    @keyup.stop=""
                  ></v-text-field>
                </v-list-item-title>

                <v-list-item-title v-else>{{ vocab.name }}</v-list-item-title>

                <template #append>
                  <div v-if="vocab.id === editId">
                    <v-btn
                      v-tooltip="'Accept'"
                      icon="mdi-check"
                      variant="text"
                      @click.stop="acceptEdit(vocab.id)"
                    ></v-btn>

                    <v-btn
                      v-tooltip="'Discard'"
                      icon="mdi-close"
                      variant="text"
                      @click.stop="discardEdit"
                    ></v-btn>
                  </div>

                  <div v-else>
                    <v-btn
                      v-tooltip="'Rename'"
                      icon="mdi-pencil"
                      variant="text"
                      @click.stop="edit(vocab.id, vocab.name)"
                    ></v-btn>

                    <v-btn
                      v-tooltip="'Export'"
                      icon="mdi-file-export"
                      variant="text"
                      @click.stop="exportVocab(vocab.id)"
                    ></v-btn>

                    <v-btn
                      v-tooltip="'Delete'"
                      icon="mdi-trash-can"
                      variant="text"
                      @click.stop="deleteVocabulary(vocab.id)"
                    ></v-btn>
                  </div>
                </template>
              </v-list-item>
            </template>

            <v-list-item v-for="tag in vocab.tags" :key="tag.id">
              <v-list-item-title v-if="tag.id === editId">
                <v-text-field v-model="editModel" density="compact" @click.stop=""></v-text-field>
              </v-list-item-title>

              <v-list-item-title v-else>{{ tag.name }}</v-list-item-title>

              <template #append>
                <div v-if="tag.id === editId">
                  <v-btn
                    v-tooltip="'Accept'"
                    icon="mdi-check"
                    variant="text"
                    @click.stop="acceptEdit(tag.id)"
                  ></v-btn>

                  <v-btn
                    v-tooltip="'Discard'"
                    icon="mdi-close"
                    variant="text"
                    @click.stop="discardEdit"
                  ></v-btn>
                </div>

                <div v-else>
                  <v-btn
                    v-tooltip="'Rename'"
                    icon="mdi-pencil"
                    variant="text"
                    @click.stop="edit(tag.id, tag.name)"
                  ></v-btn>

                  <v-btn
                    v-tooltip="'Delete'"
                    icon="mdi-trash-can"
                    variant="text"
                    @click.stop="deleteTag(vocab.id, tag.id)"
                  ></v-btn>
                </div>
              </template>
            </v-list-item>

            <v-list-item title="Add tag" prepend-icon="mdi-plus" @click="addTag(vocab.id)">
            </v-list-item>
          </v-list-group>

          <v-list-item title="Add vocabulary" prepend-icon="mdi-plus" @click="addVocabulary">
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-btn color="info" @click="importVocab">Import</v-btn>

        <v-btn color="warning" @click="dialogShown = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapStores } from 'pinia'

import { exportVocabCsv, importVocabCsv } from '@renderer/importexport'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoStore } from '@renderer/stores/undo'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'VocabularyDialog',

  data: () => ({
    dialogShown: false,
    editId: null,
    editModel: ''
  }),

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore, useUndoStore),

    vocabularies() {
      return this.undoableStore.vocabularies
    }
  },

  methods: {
    acceptEdit(id) {
      this.undoableStore.renameVocabulary(id, this.editModel)
      this.editId = null
      this.editModel = ''
    },

    addTag(vocabId) {
      this.editId = this.undoableStore.addVocabularyTag(vocabId, 'Tag')
    },

    addVocabulary() {
      this.editId = this.undoableStore.addVocabulary('Vocabulary')
    },

    deleteTag(vocabId, tagId) {
      this.undoableStore.deleteVocabularyTag(vocabId, tagId)
    },

    deleteVocabulary(vocabId) {
      this.undoableStore.deleteVocabulary(vocabId)
    },

    discardEdit() {
      this.editId = null
    },

    edit(id, name) {
      this.editId = id
      this.editModel = name
    },

    exportVocab(id) {
      exportVocabCsv(this.vocabularies.find((v) => v.id === id))
    },

    importVocab() {
      importVocabCsv()
    },

    show() {
      this.dialogShown = true
    }
  }
}
</script>
