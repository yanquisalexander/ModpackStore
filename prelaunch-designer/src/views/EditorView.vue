<template>
  <v-container fluid class="pa-0 fill-height">
    <v-row no-gutters class="fill-height">
      <!-- Left Panel - Editor Controls -->
      <v-col cols="12" md="3" class="border-e">
        <v-card flat tile height="100%">
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
      <v-col cols="12" md="6">
        <PreviewPanel />
      </v-col>

      <!-- Right Panel - Properties -->
      <v-col cols="12" md="3" class="border-s">
        <PropertiesPanel />
      </v-col>
    </v-row>

    <!-- Action Buttons -->
    <v-speed-dial
      location="bottom right"
      transition="slide-y-reverse-transition"
    >
      <template v-slot:activator="{ props: activatorProps }">
        <v-btn
          v-bind="activatorProps"
          color="primary"
          icon="mdi-menu"
          size="large"
        ></v-btn>
      </template>

      <v-btn
        icon="mdi-download"
        color="success"
        @click="exportJSON"
      >
        <v-icon>mdi-download</v-icon>
        <v-tooltip activator="parent" location="start">Exportar JSON</v-tooltip>
      </v-btn>

      <v-btn
        icon="mdi-upload"
        color="info"
        @click="showImportDialog = true"
      >
        <v-icon>mdi-upload</v-icon>
        <v-tooltip activator="parent" location="start">Importar JSON</v-tooltip>
      </v-btn>

      <v-btn
        icon="mdi-undo"
        color="warning"
        :disabled="!store.canUndo"
        @click="store.undo()"
      >
        <v-icon>mdi-undo</v-icon>
        <v-tooltip activator="parent" location="start">Deshacer</v-tooltip>
      </v-btn>

      <v-btn
        icon="mdi-redo"
        color="warning"
        :disabled="!store.canRedo"
        @click="store.redo()"
      >
        <v-icon>mdi-redo</v-icon>
        <v-tooltip activator="parent" location="start">Rehacer</v-tooltip>
      </v-btn>
    </v-speed-dial>

    <!-- Import Dialog -->
    <v-dialog v-model="showImportDialog" max-width="800">
      <v-card>
        <v-card-title>Importar Configuración JSON</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="importText"
            label="Pega tu JSON aquí"
            rows="15"
            variant="outlined"
            :error-messages="importError"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showImportDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="importJSON">Importar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import BasicSettingsPanel from '@/components/BasicSettingsPanel.vue'
import BlocksPanel from '@/components/BlocksPanel.vue'
import AdvancedPanel from '@/components/AdvancedPanel.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'

const store = useAppearanceStore()
const activeTab = ref('basic')
const showImportDialog = ref(false)
const importText = ref('')
const importError = ref<string[]>([])

const exportJSON = () => {
  const json = store.exportToJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'prelaunch-appearance.json'
  a.click()
  URL.revokeObjectURL(url)
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
</script>

<style scoped>
.fill-height {
  height: calc(100vh - 64px);
}
</style>
