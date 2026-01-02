<template>
  <div class="p-4 space-y-6">
    <div v-if="!store.selectedBlock" class="py-12 text-center">
      <MousePointer2 class="w-12 h-12 text-white/10 mx-auto mb-3" />
      <p class="text-sm text-white/40">Selecciona un bloque para editar sus propiedades</p>
    </div>

    <div v-else class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <!-- Basic Info -->
      <section class="space-y-4">
        <div class="space-y-1">
          <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Identificación</span>
          <input v-model="editingBlock.id" @input="updateBlock"
            class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
            placeholder="ID del bloque" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Etiqueta</span>
            <select v-model="editingBlock.tagName" @change="updateBlock"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
              <option v-for="tag in ['div', 'p', 'h1', 'h2', 'h3', 'span', 'section']" :key="tag" :value="tag">{{ tag }}
              </option>
            </select>
          </div>
          <div class="space-y-1">
            <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Render</span>
            <select v-model="editingBlock.renderType" @change="updateBlock"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
              <option v-for="type in ['auto', 'text', 'markdown', 'html']" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Content -->
      <section class="space-y-1">
        <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Contenido</span>
        <textarea v-model="editingBlock.content" @input="updateBlock" rows="6"
          class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary transition-colors resize-none"
          placeholder="Contenido del bloque..."></textarea>
      </section>

      <!-- Styling -->
      <section class="space-y-4">
        <div class="space-y-1">
          <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Clases CSS (Tailwind)</span>
          <input v-model="editingBlock.className" @input="updateBlock"
            class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
            placeholder="bg-black/80 p-4 rounded-xl" />
        </div>

        <div class="space-y-1">
          <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Estilos JSON</span>
          <textarea v-model="editingBlock.style" @input="updateBlock" rows="3"
            class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-primary transition-colors resize-none"
            placeholder='{ "color": "red" }'></textarea>
        </div>
      </section>

      <!-- Position -->
      <section class="space-y-3">
        <span class="text-xs font-bold text-white/60 uppercase tracking-wider">Posicionamiento</span>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <span class="text-[10px] font-medium text-white/60">Top</span>
            <input v-model="position.top" @input="updatePosition"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              placeholder="auto" />
          </div>
          <div class="space-y-1">
            <span class="text-[10px] font-medium text-white/60">Bottom</span>
            <input v-model="position.bottom" @input="updatePosition"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              placeholder="auto" />
          </div>
          <div class="space-y-1">
            <span class="text-[10px] font-medium text-white/60">Left</span>
            <input v-model="position.left" @input="updatePosition"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              placeholder="auto" />
          </div>
          <div class="space-y-1">
            <span class="text-[10px] font-medium text-white/60">Right</span>
            <input v-model="position.right" @input="updatePosition"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              placeholder="auto" />
          </div>
        </div>
        <div class="space-y-1">
          <span class="text-[10px] font-medium text-white/60">Transform</span>
          <input v-model="position.transform" @input="updatePosition"
            class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
            placeholder="translate(-50%, -50%)" />
        </div>
        <div class="space-y-1">
          <span class="text-[10px] font-medium text-white/60">Z-Index</span>
          <input type="number" v-model="position.zIndex" @input="updatePosition"
            class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary" />
        </div>
      </section>

      <button @click="deleteCurrentBlock"
        class="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2">
        <Trash2 class="w-4 h-4" />
        Eliminar Bloque
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { MousePointer2, Trash2 } from 'lucide-vue-next'

const store = useAppearanceStore()

const editingBlock = ref<any>({})
const position = ref<any>({})

const currentBlockIndex = computed(() => {
  if (!store.selectedBlock || !store.appearance.customBlocks) return -1
  return store.appearance.customBlocks.findIndex(b => b === store.selectedBlock)
})

watch(() => store.selectedBlock, (newBlock) => {
  if (newBlock) {
    editingBlock.value = { ...newBlock }
    position.value = { ...(newBlock.position || {}) }
  } else {
    editingBlock.value = {}
    position.value = {}
  }
}, { immediate: true, deep: true })

const updateBlock = () => {
  const index = currentBlockIndex.value
  if (index >= 0) {
    store.updateCustomBlock(index, {
      ...editingBlock.value,
      position: { ...position.value }
    })
  }
}

const updatePosition = () => {
  updateBlock()
}

const deleteCurrentBlock = () => {
  const index = currentBlockIndex.value
  if (index >= 0 && confirm('¿Estás seguro de que quieres eliminar este bloque?')) {
    store.removeCustomBlock(index)
  }
}
</script>
