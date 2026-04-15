<template>
  <v-list-item :active="isSelected" @click="$emit('select')">
    <v-list-item-title v-if="isEditing">
      <v-text-field
        ref="name"
        v-model="editValue"
        density="compact"
        @click.stop=""
        @keydown.stop=""
        @keyup.stop=""
        @keyup.enter="$emit('save', editValue)"
      />
    </v-list-item-title>

    <v-list-item-title v-else>
      {{ item.name }}
    </v-list-item-title>

    <template #append>
      <div v-if="isEditing" class="d-flex">
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
          @click.stop="$emit('edit')"
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

  <v-list-item v-if="item.tags">
    <v-list>
      <v-chip v-for="tag in item.tags" :key="tag.id" closable>
        {{ tag.name }}
      </v-chip>

      <v-chip prepend-icon="mdi-plus">
        {{
          $t('components.vocabularyDialogList.add', {
            itemType: $t('components.vocabularyDialogList.types.tag')
          })
        }}
      </v-chip>
    </v-list>
  </v-list-item>
</template>

<script>
export default {
  name: 'VocabularyDialogListItem',

  props: {
    isEditing: {
      type: Boolean
    },

    isSelected: {
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

  emits: ['select', 'edit', 'save', 'cancel', 'export', 'delete'],

  data() {
    return {
      editValue: ''
    }
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
