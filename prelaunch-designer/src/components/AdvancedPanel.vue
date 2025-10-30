<template>
  <v-container>
    <v-alert
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Modo editor JSON avanzado. Edita directamente la configuración.
    </v-alert>

    <v-textarea
      v-model="jsonText"
      variant="outlined"
      rows="20"
      :error-messages="errorMessages"
      class="font-monospace"
      @blur="validateAndUpdate"
    ></v-textarea>

    <v-btn
      color="primary"
      prepend-icon="mdi-content-save"
      block
      @click="validateAndUpdate"
      :disabled="!!errorMessages.length"
    >
      Aplicar Cambios
    </v-btn>

    <v-divider class="my-4"></v-divider>

    <h3 class="text-subtitle-1 mb-2">Plantillas Rápidas</h3>
    
    <v-select
      v-model="selectedTemplate"
      label="Cargar Plantilla"
      :items="templates"
      item-title="name"
      item-value="id"
      variant="outlined"
      density="comfortable"
      @update:model-value="loadTemplate"
    ></v-select>

    <v-expansion-panels class="mt-4">
      <v-expansion-panel title="Variables Dinámicas Disponibles">
        <v-expansion-panel-text>
          <v-list density="compact">
            <v-list-item>
              <v-list-item-title><code>$date()</code></v-list-item-title>
              <v-list-item-subtitle>Fecha actual</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title><code>$time()</code></v-list-item-title>
              <v-list-item-subtitle>Hora actual</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title><code>$username(default)</code></v-list-item-title>
              <v-list-item-subtitle>Nombre de usuario autenticado</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title><code>$mcAccountName(default)</code></v-list-item-title>
              <v-list-item-subtitle>Cuenta de Minecraft</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title><code>$fetch(url, default)</code></v-list-item-title>
              <v-list-item-subtitle>Petición HTTP</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title><code>$onlinePlayers(host:port)</code></v-list-item-title>
              <v-list-item-subtitle>Jugadores online en servidor</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title><code>$random(min, max)</code></v-list-item-title>
              <v-list-item-subtitle>Número aleatorio</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { storeToRefs } from 'pinia'

const store = useAppearanceStore()
const { appearance } = storeToRefs(store)

const jsonText = ref(JSON.stringify(appearance.value, null, 2))
const errorMessages = ref<string[]>([])
const selectedTemplate = ref<string | null>(null)

const templates = [
  {
    id: 'basic',
    name: 'Básico',
    config: {
      title: 'Mi Servidor',
      description: 'La mejor experiencia de Minecraft',
      logo: {
        url: 'https://example.com/logo.png',
        height: '56px',
        position: {
          top: '8rem',
          left: '50%',
          transform: 'translateX(-50%)'
        }
      },
      playButton: {
        text: 'Jugar ahora',
        backgroundColor: '#00a63e',
        textColor: '#ffffff'
      },
      background: {
        videoUrl: '/assets/videos/prelaunch-default-1.mp4'
      },
      customBlocks: []
    }
  },
  {
    id: 'with-news',
    name: 'Con Panel de Noticias',
    config: {
      title: 'Mi Servidor',
      customBlocks: [
        {
          id: 'news-panel',
          className: 'bg-black/80 text-white p-6 rounded-xl max-w-lg',
          tagName: 'div',
          content: '# 📰 Noticias\n\n## Nueva actualización\n¡Mods actualizados a la última versión!',
          renderType: 'markdown',
          position: {
            top: '20rem',
            right: '2rem',
            zIndex: 10
          }
        }
      ]
    }
  },
  {
    id: 'server-status',
    name: 'Con Estado del Servidor',
    config: {
      customBlocks: [
        {
          id: 'server-status',
          className: 'bg-green-600/90 text-white px-4 py-2 rounded-full',
          tagName: 'div',
          content: '🟢 Online - $onlinePlayers(mc.example.com) jugadores',
          renderType: 'text',
          position: {
            top: '2rem',
            right: '2rem',
            zIndex: 20
          }
        }
      ]
    }
  }
]

watch(appearance, (newVal) => {
  jsonText.value = JSON.stringify(newVal, null, 2)
}, { deep: true })

const validateAndUpdate = () => {
  try {
    const parsed = JSON.parse(jsonText.value)
    store.setAppearance(parsed)
    errorMessages.value = []
  } catch (error) {
    errorMessages.value = [error instanceof Error ? error.message : 'JSON inválido']
  }
}

const loadTemplate = () => {
  const template = templates.find(t => t.id === selectedTemplate.value)
  if (template) {
    jsonText.value = JSON.stringify(template.config, null, 2)
    validateAndUpdate()
  }
}
</script>

<style scoped>
.font-monospace {
  font-family: 'Courier New', Courier, monospace;
}
</style>
