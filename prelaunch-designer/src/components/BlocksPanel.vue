<template>
  <div class="space-y-4">
    <button @click="showAddDialog = true"
      class="w-full py-3 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
      <Plus class="w-4 h-4" />
      Agregar Bloque
    </button>

    <div class="space-y-2">
      <div v-for="(block, index) in appearance.customBlocks" :key="index" @click="selectBlock(block, index)" :class="[
        'p-3 rounded-xl border transition-all cursor-pointer group',
        selectedBlockIndex === index
          ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      ]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center',
              selectedBlockIndex === index ? 'bg-primary text-white' : 'bg-white/10 text-white/60'
            ]">
              <Box class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-medium">{{ block.id || `Bloque ${index + 1}` }}</h4>
              <p class="text-xs text-white/40">{{ block.tagName || 'div' }} • {{ block.renderType || 'auto' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button @click.stop="moveBlockUp(index)" :disabled="index === 0"
              class="p-1.5 hover:bg-white/10 rounded disabled:opacity-30">
              <ArrowUp class="w-3.5 h-3.5" />
            </button>
            <button @click.stop="moveBlockDown(index)" :disabled="index === (appearance.customBlocks?.length || 0) - 1"
              class="p-1.5 hover:bg-white/10 rounded disabled:opacity-30">
              <ArrowDown class="w-3.5 h-3.5" />
            </button>
            <button @click.stop="deleteBlock(index)" class="p-1.5 hover:bg-red-500/20 text-red-400 rounded">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="!appearance.customBlocks?.length" class="py-12 text-center">
        <Box class="w-12 h-12 text-white/10 mx-auto mb-3" />
        <p class="text-sm text-white/40">No hay bloques personalizados</p>
      </div>
    </div>

    <!-- Add Block Dialog -->
    <div v-if="showAddDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showAddDialog = false"></div>
      <div class="liquid-glass w-full max-w-md p-6 rounded-2xl relative z-10">
        <h3 class="text-xl font-bold mb-6">Nuevo Bloque</h3>

        <div class="space-y-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">ID del Bloque</span>
            <input v-model="newBlock.id"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="mi-bloque-personalizado" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <span class="text-sm font-medium text-white/90">Etiqueta HTML</span>
              <select v-model="newBlock.tagName"
                class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
                <option v-for="tag in ['div', 'p', 'h1', 'h2', 'h3', 'span', 'section']" :key="tag" :value="tag"
                  class="bg-zinc-900">{{ tag
                  }}</option>
              </select>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-white/90">Renderizado</span>
              <select v-model="newBlock.renderType"
                class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
                <option v-for="type in ['auto', 'text', 'markdown', 'html']" :key="type" :value="type"
                  class="bg-zinc-900">{{ type }}
                </option>
              </select>
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Contenido</span>
            <textarea v-model="newBlock.content" rows="4"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Escribe aquí el contenido..."></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-8">
          <button @click="showAddDialog = false"
            class="px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">Cancelar</button>
          <button @click="addNewBlock"
            class="px-6 py-2 bg-primary rounded-lg font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-all">Crear
            Bloque</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { Plus, Box, Trash2, ArrowUp, ArrowDown } from 'lucide-vue-next'

const store = useAppearanceStore()
const appearance = computed(() => store.appearance)
const selectedBlockIndex = computed(() => {
  if (!store.selectedBlock || !appearance.value.customBlocks) return -1
  return appearance.value.customBlocks.findIndex(b => b === store.selectedBlock)
})

const showAddDialog = ref(false)
const newBlock = ref({
  id: '',
  tagName: 'div',
  renderType: 'auto',
  content: '',
  className: '',
  style: '{}',
  position: {
    top: '0',
    left: '0'
  }
})

const selectBlock = (block: any, index: number) => {
  store.selectBlock(block)
}

const addNewBlock = () => {
  const blocks = [...(appearance.value.customBlocks || [])]
  const block = { ...newBlock.value }
  blocks.push(block)
  store.updateAppearance({ ...appearance.value, customBlocks: blocks })
  store.selectBlock(block)
  showAddDialog.value = false
  // Reset new block
  newBlock.value = {
    id: '',
    tagName: 'div',
    renderType: 'auto',
    content: '',
    className: '',
    style: '{}',
    position: { top: '0', left: '0' }
  }
}

const deleteBlock = (index: number) => {
  const blocks = [...(appearance.value.customBlocks || [])]
  const isSelected = selectedBlockIndex.value === index
  blocks.splice(index, 1)
  store.updateAppearance({ ...appearance.value, customBlocks: blocks })
  if (isSelected) {
    store.selectBlock(null)
  }
}

const moveBlockUp = (index: number) => {
  if (index === 0) return
  const blocks = [...(appearance.value.customBlocks || [])]
  const temp = blocks[index]
  blocks[index] = blocks[index - 1]
  blocks[index - 1] = temp
  store.updateAppearance({ ...appearance.value, customBlocks: blocks })
}

const moveBlockDown = (index: number) => {
  if (index === (appearance.value.customBlocks?.length || 0) - 1) return
  const blocks = [...(appearance.value.customBlocks || [])]
  const temp = blocks[index]
  blocks[index] = blocks[index + 1]
  blocks[index + 1] = temp
  store.updateAppearance({ ...appearance.value, customBlocks: blocks })
}
</script>
