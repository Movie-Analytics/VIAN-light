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
          icon="mdi-check"
          variant="text"
          size="small"
          @click.stop="$emit('save', editValue)"
        />

        <v-btn icon="mdi-close" variant="text" size="small" @click.stop="$emit('cancel')" />
      </div>

      <div v-else class="d-flex">
        <v-btn icon="mdi-pencil" variant="text" size="small" @click.stop="$emit('edit', item.id)" />

        <v-btn
          v-if="showExport"
          icon="mdi-file-export"
          variant="text"
          size="small"
          @click.stop="$emit('export', item.id)"
        />

        <v-btn
          icon="mdi-trash-can"
          variant="text"
          size="small"
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
