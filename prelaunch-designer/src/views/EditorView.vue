<template>
  <div class="flex-1 flex overflow-hidden relative">
    <!-- Left Panel - Editor Controls -->
    <aside v-show="!leftPanelCollapsed && !fullscreenPreview"
      class="w-80 glass-dark border-r border-white/10 flex flex-col transition-all duration-300">
      <div class="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 class="font-semibold flex items-center gap-2">
          <Settings2 class="w-4 h-4 text-primary" />
          Controles
        </h2>
        <button @click="leftPanelCollapsed = true" class="p-1 hover:bg-white/5 rounded transition-colors">
          <ChevronLeft class="w-4 h-4" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div class="flex p-1 bg-black/20 rounded-lg mb-6">
          <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="[
            'flex-1 py-2 text-sm font-medium rounded-md transition-all',
            activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/60 hover:text-white'
          ]">
            {{ tab.label }}
          </button>
        </div>

        <div class="space-y-4">
          <BasicSettingsPanel v-if="activeTab === 'basic'" />
          <BlocksPanel v-if="activeTab === 'blocks'" />
          <AdvancedPanel v-if="activeTab === 'advanced'" />
        </div>
      </div>
    </aside>

    <!-- Center Panel - Preview -->
    <main class="flex-1 relative bg-black/40 overflow-hidden flex flex-col">
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
        <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-accent/5 blur-[120px] rounded-full"></div>
      </div>

      <div class="p-4 flex items-center justify-between relative z-10">
        <div class="flex items-center gap-2">
          <button v-if="leftPanelCollapsed && !fullscreenPreview" @click="leftPanelCollapsed = false"
            class="p-2 glass hover:bg-white/10 rounded-lg transition-all">
            <ChevronRight class="w-4 h-4" />
          </button>
          <div class="px-3 py-1 glass rounded-full text-xs font-medium text-white/60 flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            Live Preview
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="toggleFullscreen" class="p-2 glass hover:bg-white/10 rounded-lg transition-all">
            <Maximize2 v-if="!fullscreenPreview" class="w-4 h-4" />
            <Minimize2 v-else class="w-4 h-4" />
          </button>
          <button v-if="rightPanelCollapsed && !fullscreenPreview" @click="rightPanelCollapsed = false"
            class="p-2 glass hover:bg-white/10 rounded-lg transition-all">
            <ChevronLeft class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex-1 flex items-start justify-center p-8 overflow-auto">
        <PreviewPanel />
      </div>
    </main>

    <!-- Right Panel - Properties -->
    <aside v-show="!rightPanelCollapsed && !fullscreenPreview"
      class="w-80 glass-dark border-l border-white/10 flex flex-col transition-all duration-300">
      <div class="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 class="font-semibold flex items-center gap-2">
          <Sliders class="w-4 h-4 text-primary" />
          Propiedades
        </h2>
        <button @click="rightPanelCollapsed = true" class="p-1 hover:bg-white/5 rounded transition-colors">
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <PropertiesPanel />
      </div>
    </aside>

    <!-- Floating Action Menu -->
    <div v-show="!fullscreenPreview" class="fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
      <div v-if="menuOpen" class="flex flex-col gap-3 mb-3 animate-in slide-in-from-bottom-4 duration-200">
        <button @click="exportJSON" class="group flex items-center gap-3">
          <span class="px-2 py-1 glass rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">Exportar
            JSON</span>
          <div
            class="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20 hover:scale-110 transition-transform">
            <Download class="w-5 h-5 text-white" />
          </div>
        </button>
        <button @click="showImportDialog = true" class="group flex items-center gap-3">
          <span class="px-2 py-1 glass rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">Importar
            JSON</span>
          <div
            class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-110 transition-transform">
            <Upload class="w-5 h-5 text-white" />
          </div>
        </button>
        <button @click="store.undo()" :disabled="!store.canUndo"
          class="group flex items-center gap-3 disabled:opacity-50">
          <span
            class="px-2 py-1 glass rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">Deshacer</span>
          <div
            class="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 hover:scale-110 transition-transform">
            <Undo2 class="w-5 h-5 text-white" />
          </div>
        </button>
        <button @click="store.redo()" :disabled="!store.canRedo"
          class="group flex items-center gap-3 disabled:opacity-50">
          <span
            class="px-2 py-1 glass rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">Rehacer</span>
          <div
            class="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 hover:scale-110 transition-transform">
            <Redo2 class="w-5 h-5 text-white" />
          </div>
        </button>
      </div>

      <button @click="menuOpen = !menuOpen"
        class="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
        <X v-if="menuOpen" class="w-6 h-6 text-white" />
        <Menu v-else class="w-6 h-6 text-white" />
      </button>
    </div>

    <!-- Import Dialog -->
    <div v-if="showImportDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showImportDialog = false"></div>
      <div class="liquid-glass w-full max-w-lg p-6 rounded-2xl relative z-10">
        <h3 class="text-xl font-bold mb-4">Importar Configuración</h3>
        <p class="text-white/60 text-sm mb-6">Pega el JSON de tu configuración de prelaunch para cargarla en el editor.
        </p>

        <textarea v-model="importJSONText"
          class="w-full h-64 bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-sm focus:outline-none focus:border-primary transition-colors mb-6"
          placeholder='{ "title": "Mi Servidor", ... }'></textarea>

        <div class="flex justify-end gap-3">
          <button @click="showImportDialog = false"
            class="px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">Cancelar</button>
          <button @click="importJSON"
            class="px-6 py-2 bg-primary rounded-lg font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-all">Importar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import BasicSettingsPanel from '@/components/BasicSettingsPanel.vue'
import BlocksPanel from '@/components/BlocksPanel.vue'
import AdvancedPanel from '@/components/AdvancedPanel.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import {
  Settings2, Sliders, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Menu, X, Download, Upload,
  Undo2, Redo2
} from 'lucide-vue-next'

const store = useAppearanceStore()

const activeTab = ref('basic')
const tabs = [
  { id: 'basic', label: 'Básico' },
  { id: 'blocks', label: 'Bloques' },
  { id: 'advanced', label: 'Avanzado' }
]

const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)
const fullscreenPreview = ref(false)
const menuOpen = ref(false)
const showImportDialog = ref(false)
const importJSONText = ref('')

const toggleFullscreen = () => {
  fullscreenPreview.value = !fullscreenPreview.value
  store.showAppBar = !fullscreenPreview.value
}

const exportJSON = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.appearance, null, 2))
  const downloadAnchorNode = document.createElement('a')
  downloadAnchorNode.setAttribute("href", dataStr)
  downloadAnchorNode.setAttribute("download", "prelaunch-appearance.json")
  document.body.appendChild(downloadAnchorNode)
  downloadAnchorNode.click()
  downloadAnchorNode.remove()
}

const importJSON = () => {
  try {
    const parsed = JSON.parse(importJSONText.value)
    store.setAppearance(parsed)
    showImportDialog.value = false
    importJSONText.value = ''
  } catch (e) {
    alert('JSON inválido')
  }
}
</script>
