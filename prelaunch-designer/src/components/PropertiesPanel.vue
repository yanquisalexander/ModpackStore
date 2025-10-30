<template>
  <v-card flat tile height="100%">
    <v-card-title>Propiedades</v-card-title>
    
    <v-card-text v-if="!store.selectedBlock">
      <v-alert type="info" variant="tonal">
        Selecciona un bloque de la lista para editar sus propiedades
      </v-alert>
    </v-card-text>

    <v-card-text v-else class="properties-form">
      <v-text-field
        v-model="editingBlock.id"
        label="ID del Bloque"
        variant="outlined"
        density="comfortable"
        @update:model-value="updateBlock"
      ></v-text-field>

      <v-select
        v-model="editingBlock.tagName"
        label="Etiqueta HTML"
        :items="['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'section', 'article', 'aside']"
        variant="outlined"
        density="comfortable"
        @update:model-value="updateBlock"
      ></v-select>

      <v-select
        v-model="editingBlock.renderType"
        label="Tipo de Renderizado"
        :items="['auto', 'text', 'markdown', 'html']"
        variant="outlined"
        density="comfortable"
        @update:model-value="updateBlock"
      ></v-select>

      <v-textarea
        v-model="editingBlock.content"
        label="Contenido"
        variant="outlined"
        rows="6"
        @update:model-value="updateBlock"
      ></v-textarea>

      <v-text-field
        v-model="editingBlock.className"
        label="Clases CSS"
        variant="outlined"
        density="comfortable"
        placeholder="text-white bg-black/80 p-4"
        @update:model-value="updateBlock"
      ></v-text-field>

      <v-divider class="my-4"></v-divider>

      <h3 class="text-subtitle-2 mb-2">Posición</h3>

      <v-row>
        <v-col cols="6">
          <v-text-field
            v-model="position.top"
            label="Top"
            variant="outlined"
            density="comfortable"
            placeholder="2rem"
            @update:model-value="updatePosition"
          ></v-text-field>
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model="position.bottom"
            label="Bottom"
            variant="outlined"
            density="comfortable"
            placeholder="2rem"
            @update:model-value="updatePosition"
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="6">
          <v-text-field
            v-model="position.left"
            label="Left"
            variant="outlined"
            density="comfortable"
            placeholder="2rem"
            @update:model-value="updatePosition"
          ></v-text-field>
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model="position.right"
            label="Right"
            variant="outlined"
            density="comfortable"
            placeholder="2rem"
            @update:model-value="updatePosition"
          ></v-text-field>
        </v-col>
      </v-row>

      <v-text-field
        v-model="position.transform"
        label="Transform"
        variant="outlined"
        density="comfortable"
        placeholder="translateX(-50%)"
        @update:model-value="updatePosition"
      ></v-text-field>

      <v-text-field
        v-model.number="position.zIndex"
        label="Z-Index"
        type="number"
        variant="outlined"
        density="comfortable"
        @update:model-value="updatePosition"
      ></v-text-field>

      <v-divider class="my-4"></v-divider>

      <h3 class="text-subtitle-2 mb-2">Estilos Adicionales (JSON)</h3>
      
      <v-textarea
        v-model="editingBlock.style"
        label="Estilos JSON"
        variant="outlined"
        rows="4"
        placeholder='{"color": "red", "fontSize": "1.5rem"}'
        @update:model-value="updateBlock"
      ></v-textarea>

      <v-btn
        color="error"
        prepend-icon="mdi-delete"
        block
        @click="deleteCurrentBlock"
        class="mt-4"
      >
        Eliminar Bloque
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import type { CustomBlock, CustomBlockPosition } from '@/types/PreLaunchAppearance'

const store = useAppearanceStore()

const editingBlock = ref<CustomBlock>({})
const position = ref<CustomBlockPosition>({})

const currentBlockIndex = computed(() => {
  if (!store.selectedBlock || !store.appearance.customBlocks) return -1
  return store.appearance.customBlocks.findIndex(b => b === store.selectedBlock)
})

watch(() => store.selectedBlock, (newBlock) => {
  if (newBlock) {
    editingBlock.value = { ...newBlock }
    position.value = { ...(newBlock.position || {}) }
  }
}, { immediate: true, deep: true })

const updateBlock = () => {
  const index = currentBlockIndex.value
  if (index >= 0) {
    store.updateCustomBlock(index, {
      ...editingBlock.value,
      position: position.value
    })
  }
}

const updatePosition = () => {
  editingBlock.value.position = { ...position.value }
  updateBlock()
}

const deleteCurrentBlock = () => {
  const index = currentBlockIndex.value
  if (index >= 0 && confirm('¿Estás seguro de que quieres eliminar este bloque?')) {
    store.removeCustomBlock(index)
  }
}
</script>

<style scoped>
.properties-form {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}
</style>
