<template>
  <v-chip closable class="editable-chip ma-1" @click:close="$emit('delete')" @click="$emit('edit')">
    <template v-if="isEditing">
      <v-text-field
        ref="name"
        v-model="editValue"
        density="compact"
        min-width="100"
        class="tag-input"
        @click.stop=""
        @keydown.stop=""
        @keyup.stop=""
        @keyup.enter="$emit('save', editValue)"
      />
    </template>

    <template v-else>
      {{ item.name }}
    </template>
  </v-chip>
</template>

<script>
import { mapStores } from 'pinia'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'VocabularyDialogTag',

  props: {
    isEditing: {
      type: Boolean
    },

    item: {
      type: Object,
      required: true
    }
  },

  emits: ['edit', 'save', 'delete'],

  data() {
    return {
      editValue: ''
    }
  },

  computed: {
    ...mapStores(useUndoableStore)
  },

  watch: {
    async isEditing(newVal) {
      if (newVal) {
        await this.$nextTick()
        this.$refs.name.focus()
        this.$refs.name.select()
      }
    }
  },

  async mounted() {
    this.editValue = this.item.name
    if (this.isEditing) {
      await this.$nextTick()
      this.$refs.name.focus()
      this.$refs.name.select()
    }
  }
}
</script>

<style scoped>
.editable-chip .v-text-field :deep(.v-field__input) {
  padding: 0 !important;
  height: auto !important;
  text-align: center;
}
.editable-chip .v-text-field :deep(.v-input__details) {
  display: none;
}
</style>
