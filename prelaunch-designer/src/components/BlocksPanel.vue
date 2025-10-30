<template>
  <v-container>
    <v-btn
      color="primary"
      prepend-icon="mdi-plus"
      block
      @click="addNewBlock"
      class="mb-4"
    >
      Agregar Bloque
    </v-btn>

    <v-list>
      <v-list-item
        v-for="(block, index) in appearance.customBlocks"
        :key="index"
        @click="selectBlock(block, index)"
        :active="selectedBlockIndex === index"
        class="mb-2"
      >
        <template v-slot:prepend>
          <v-icon>mdi-cube-outline</v-icon>
        </template>

        <v-list-item-title>
          {{ block.id || `Bloque ${index + 1}` }}
        </v-list-item-title>

        <v-list-item-subtitle>
          {{ block.tagName || 'div' }} - {{ block.renderType || 'auto' }}
        </v-list-item-subtitle>

        <template v-slot:append>
          <v-btn
            icon="mdi-arrow-up"
            variant="text"
            size="small"
            :disabled="index === 0"
            @click.stop="moveBlockUp(index)"
          ></v-btn>
          <v-btn
            icon="mdi-arrow-down"
            variant="text"
            size="small"
            :disabled="index === (appearance.customBlocks?.length || 0) - 1"
            @click.stop="moveBlockDown(index)"
          ></v-btn>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click.stop="deleteBlock(index)"
          ></v-btn>
        </template>
      </v-list-item>

      <v-list-item v-if="!appearance.customBlocks?.length">
        <v-list-item-title class="text-center text-disabled">
          No hay bloques personalizados
        </v-list-item-title>
      </v-list-item>
    </v-list>

    <!-- Add Block Dialog -->
    <v-dialog v-model="showAddDialog" max-width="600">
      <v-card>
        <v-card-title>Agregar Nuevo Bloque</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newBlock.id"
            label="ID del Bloque"
            variant="outlined"
            density="comfortable"
          ></v-text-field>

          <v-select
            v-model="newBlock.tagName"
            label="Etiqueta HTML"
            :items="['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'section', 'article']"
            variant="outlined"
            density="comfortable"
          ></v-select>

          <v-select
            v-model="newBlock.renderType"
            label="Tipo de Renderizado"
            :items="['auto', 'text', 'markdown', 'html']"
            variant="outlined"
            density="comfortable"
          ></v-select>

          <v-textarea
            v-model="newBlock.content"
            label="Contenido"
            variant="outlined"
            rows="4"
          ></v-textarea>

          <v-text-field
            v-model="newBlock.className"
            label="Clases CSS"
            variant="outlined"
            density="comfortable"
            placeholder="text-white text-center"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showAddDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="confirmAddBlock">Agregar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { storeToRefs } from 'pinia'
import type { CustomBlock } from '@/types/PreLaunchAppearance'

const store = useAppearanceStore()
const { appearance } = storeToRefs(store)

const selectedBlockIndex = ref<number | null>(null)
const showAddDialog = ref(false)
const newBlock = ref<CustomBlock>({
  id: '',
  tagName: 'div',
  renderType: 'auto',
  content: '',
  className: ''
})

const addNewBlock = () => {
  newBlock.value = {
    id: `block-${Date.now()}`,
    tagName: 'div',
    renderType: 'auto',
    content: '',
    className: ''
  }
  showAddDialog.value = true
}

const confirmAddBlock = () => {
  store.addCustomBlock({ ...newBlock.value })
  showAddDialog.value = false
}

const selectBlock = (block: CustomBlock, index: number) => {
  selectedBlockIndex.value = index
  store.selectBlock(block)
}

const moveBlockUp = (index: number) => {
  if (index > 0) {
    store.moveCustomBlock(index, index - 1)
    if (selectedBlockIndex.value === index) {
      selectedBlockIndex.value = index - 1
    }
  }
}

const moveBlockDown = (index: number) => {
  const maxIndex = (appearance.value.customBlocks?.length || 0) - 1
  if (index < maxIndex) {
    store.moveCustomBlock(index, index + 1)
    if (selectedBlockIndex.value === index) {
      selectedBlockIndex.value = index + 1
    }
  }
}

const deleteBlock = (index: number) => {
  if (confirm('¿Estás seguro de que quieres eliminar este bloque?')) {
    store.removeCustomBlock(index)
    if (selectedBlockIndex.value === index) {
      selectedBlockIndex.value = null
    }
  }
}
</script>
