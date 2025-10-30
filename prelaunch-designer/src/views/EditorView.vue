<template>
  <v-container fluid class="pa-0" :class="containerClass">
    <v-row no-gutters class="fill-height">
      <!-- Left Panel - Editor Controls -->
      <v-col :cols="leftPanelCols.cols" :md="leftPanelCols.md" class="border-e"
        v-show="!leftPanelCollapsed && !fullscreenPreview">
        <v-card flat tile height="100%">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Controles del Editor</span>
            <v-btn icon="mdi-chevron-left" size="small" variant="text"
              @click="leftPanelCollapsed = !leftPanelCollapsed">
              <v-tooltip activator="parent">Colapsar panel izquierdo</v-tooltip>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-tabs v-model="activeTab" color="primary" align-tabs="center">
              <v-tab value="basic">Básico</v-tab>
              <v-tab value="blocks">Bloques</v-tab>
              <v-tab value="advanced">Avanzado</v-tab>
            </v-tabs>

            <v-window v-model="activeTab" class="mt-4">
              <v-window-item value="basic">
                <BasicSettingsPanel />
              </v-window-item>

              <v-window-item value="blocks">
                <BlocksPanel />
              </v-window-item>

              <v-window-item value="advanced">
                <AdvancedPanel />
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Center Panel - Preview -->
      <v-col :cols="centerPanelCols.cols" :md="centerPanelCols.md">
        <PreviewPanel />
      </v-col>

      <!-- Right Panel - Properties -->
      <v-col :cols="rightPanelCols.cols" :md="rightPanelCols.md" class="border-s"
        v-show="!rightPanelCollapsed && !fullscreenPreview">
        <v-card flat tile height="100%">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Propiedades</span>
            <v-btn icon="mdi-chevron-right" size="small" variant="text"
              @click="rightPanelCollapsed = !rightPanelCollapsed">
              <v-tooltip activator="parent">Colapsar panel derecho</v-tooltip>
            </v-btn>
          </v-card-title>
          <PropertiesPanel />
        </v-card>
      </v-col>
    </v-row>

    <!-- Action Buttons -->
    <v-fab size="large" app fixed icon color="primary" v-show="!fullscreenPreview">
      <v-icon>{{ open ? 'mdi-close' : 'mdi-menu' }}</v-icon>
      <v-speed-dial v-model="open" transition="slide-y-reverse-transition" activator="parent">
        <v-btn key="download" icon="mdi-download" color="success" @click="exportJSON">
          <v-icon>mdi-download</v-icon>
          <v-tooltip activator="parent" location="start">Exportar JSON</v-tooltip>
        </v-btn>

        <v-btn key="upload" icon="mdi-upload" color="info" @click="showImportDialog = true">
          <v-icon>mdi-upload</v-icon>
          <v-tooltip activator="parent" location="start">Importar JSON</v-tooltip>
        </v-btn>

        <v-btn key="undo" icon="mdi-undo" color="warning" :disabled="!store.canUndo" @click="store.undo()">
          <v-icon>mdi-undo</v-icon>
          <v-tooltip activator="parent" location="start">Deshacer</v-tooltip>
        </v-btn>

        <v-btn key="redo" icon="mdi-redo" color="warning" :disabled="!store.canRedo" @click="store.redo()">
          <v-icon>mdi-redo</v-icon>
          <v-tooltip activator="parent" location="start">Rehacer</v-tooltip>
        </v-btn>

        <v-btn key="fullscreen" icon="mdi-fullscreen" color="secondary" @click="toggleFullscreen">
          <v-icon>{{ fullscreenPreview ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
          <v-tooltip activator="parent" location="start">
            {{ fullscreenPreview ? 'Salir de pantalla completa' : 'Vista previa en pantalla completa' }}
          </v-tooltip>
        </v-btn>
      </v-speed-dial>
    </v-fab>

    <!-- Fullscreen Exit Button -->
    <v-btn v-show="fullscreenPreview" fab size="small" color="secondary" fixed top right @click="toggleFullscreen"
      class="ma-4">
      <v-icon>mdi-fullscreen-exit</v-icon>
      <v-tooltip activator="parent">Salir de pantalla completa</v-tooltip>
    </v-btn>

    <!-- Export Dialog -->
    <v-dialog v-model="showExportDialog" max-width="600">
      <v-card>
        <v-card-title>Exportar JSON</v-card-title>
        <v-card-text>
          <v-textarea v-model="exportText" readonly label="JSON Exportado"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showExportDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Import Dialog -->
    <v-dialog v-model="showImportDialog" max-width="600">
      <v-card>
        <v-card-title>Importar JSON</v-card-title>
        <v-card-text>
          <v-textarea v-model="importText" label="Pegar JSON aquí" :error-messages="importError"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showImportDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="importJSON">Importar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import BasicSettingsPanel from '@/components/BasicSettingsPanel.vue'
import BlocksPanel from '@/components/BlocksPanel.vue'
import AdvancedPanel from '@/components/AdvancedPanel.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'

const store = useAppearanceStore()
const activeTab = ref('basic')
const showImportDialog = ref(false)
const showExportDialog = ref(false)
const importText = ref('')
const exportText = ref('')
const importError = ref<string[]>([])
const open = ref(false)
const fullscreenPreview = ref(false)

// Panel collapse state
const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)

// Dynamic column classes
const leftPanelCols = computed(() => ({
  cols: 12,
  md: fullscreenPreview.value ? 0 : (leftPanelCollapsed.value ? 0 : 3)
}))

const centerPanelCols = computed(() => {
  if (fullscreenPreview.value) {
    return {
      cols: 12,
      md: 12
    }
  }

  const leftCollapsed = leftPanelCollapsed.value
  const rightCollapsed = rightPanelCollapsed.value

  let md = 6
  if (leftCollapsed && rightCollapsed) md = 12
  else if (leftCollapsed || rightCollapsed) md = 9

  return {
    cols: 12,
    md
  }
})

const rightPanelCols = computed(() => ({
  cols: 12,
  md: fullscreenPreview.value ? 0 : (rightPanelCollapsed.value ? 0 : 3)
}))

const containerClass = computed(() => ({
  'fill-height': true,
  'fill-height-no-appbar': !store.showAppBar
}))

const exportJSON = () => {
  const json = store.exportToJSON()
  exportText.value = json
  showExportDialog.value = true
}

const importJSON = () => {
  const result = store.importFromJSON(importText.value)
  if (result.success) {
    showImportDialog.value = false
    importText.value = ''
    importError.value = []
  } else {
    importError.value = [result.error || 'Error al importar JSON']
  }
}

const toggleFullscreen = () => {
  fullscreenPreview.value = !fullscreenPreview.value
  store.setShowAppBar(!fullscreenPreview.value)
}


</script>

<style scoped>
.fill-height {
  height: calc(100vh - 64px);
}

.fill-height-no-appbar {
  height: 100vh;
}

.panel-toggle-buttons {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
}

.panel-collapse-left {
  position: absolute;
  left: 0;
  top: 20px;
  border-radius: 0 4px 4px 0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

.panel-collapse-right {
  position: absolute;
  right: 0;
  top: 20px;
  border-radius: 4px 0 0 4px;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
}

.panel-toggle-left {
  position: absolute;
  left: 0;
  border-radius: 0 4px 4px 0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

.panel-toggle-right {
  position: absolute;
  right: 0;
  border-radius: 4px 0 0 4px;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
}

/* Smooth transitions for panel collapse/expand */
.v-col {
  transition: all 0.3s ease-in-out;
}
</style>
