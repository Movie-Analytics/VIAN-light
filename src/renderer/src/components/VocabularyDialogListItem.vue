<template>
  <v-list-item>
    <v-list-item-title v-if="isEditing">
      <v-text-field
        v-model="editValue"
        density="compact"
        @click.stop=""
        @keydown.stop=""
        @keyup.stop=""
      />
    </v-list-item-title>

    <v-list-item-title v-else>
      {{ item.name }}
    </v-list-item-title>

    <template #append>
      <div v-if="isEditing" class="d-flex">
        <v-btn
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.save'),
            location: 'bottom'
          }"
          icon="mdi-check"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.save')"
          @click.stop="$emit('save', editValue)"
        />

        <v-btn
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.cancel'),
            location: 'bottom'
          }"
          icon="mdi-close"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.cancel')"
          @click.stop="$emit('cancel')"
        />
      </div>

      <div v-else class="d-flex">
        <v-btn
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.editItem'),
            location: 'bottom'
          }"
          icon="mdi-pencil"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.editItem')"
          @click.stop="$emit('edit', item.id)"
        />

        <v-btn
          v-if="showExport"
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.exportItem'),
            location: 'bottom'
          }"
          icon="mdi-file-export"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.exportItem')"
          @click.stop="$emit('export', item.id)"
        />

        <v-btn
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.deleteItem'),
            location: 'bottom'
          }"
          icon="mdi-trash-can"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.deleteItem')"
          @click.stop="$emit('delete', item.id)"
        />
      </div>
    </template>
  </v-list-item>
</template>

<script>
export default {
  name: 'VocabularyDialogListItem',

  props: {
    isEditing: {
      type: Boolean
    },

    item: {
      type: Object,
      required: true
    },

    showExport: {
      type: Boolean
    }
  },

  emits: ['edit', 'save', 'cancel', 'export', 'delete'],

  data() {
    return {
      editValue: ''
    }
  },

  mounted() {
    this.editValue = this.item.name
  }
}
</script>
