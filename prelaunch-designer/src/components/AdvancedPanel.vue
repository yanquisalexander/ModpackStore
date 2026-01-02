<template>
  <div class="space-y-6">
    <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3">
      <Info class="w-5 h-5 text-blue-400 shrink-0" />
      <p class="text-xs text-blue-200/80 leading-relaxed">
        Modo editor JSON avanzado. Edita directamente la configuración para un control total.
      </p>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">Configuración JSON</label>
        <span v-if="errorMessages.length" class="text-[10px] text-red-400 font-bold">{{ errorMessages[0] }}</span>
      </div>
      <textarea v-model="jsonText" @blur="validateAndUpdate" rows="15"
        class="w-full bg-black/60 border border-white/20 rounded-xl p-4 font-mono text-xs text-white focus:outline-none focus:border-primary transition-colors resize-none"
        :class="{ 'border-red-500/50': errorMessages.length }"></textarea>
      <button @click="validateAndUpdate" :disabled="!!errorMessages.length"
        class="w-full py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all">
        Aplicar Cambios
      </button>
    </div>

    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">Plantillas Rápidas</label>
        <select v-model="selectedTemplate" @change="loadTemplate"
          class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
          <option :value="null" disabled class="bg-zinc-900">Seleccionar plantilla...</option>
          <option v-for="template in templates" :key="template.id" :value="template.id" class="bg-zinc-900">{{
            template.name }}</option>
        </select>
      </div>

      <div class="space-y-2">
        <button @click="showVariables = !showVariables"
          class="w-full p-3 glass rounded-xl flex items-center justify-between text-sm hover:bg-white/10 transition-colors">
          <span class="font-medium">Variables Dinámicas</span>
          <ChevronDown :class="['w-4 h-4 transition-transform', showVariables ? 'rotate-180' : '']" />
        </button>

        <div v-if="showVariables"
          class="p-3 glass rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div v-for="variable in variables" :key="variable.code" class="space-y-1">
            <code class="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{{ variable.code }}</code>
            <p class="text-[10px] text-white/40">{{ variable.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { storeToRefs } from 'pinia'
import { Info, ChevronDown } from 'lucide-vue-next'

const store = useAppearanceStore()
const { appearance } = storeToRefs(store)

const jsonText = ref(JSON.stringify(appearance.value, null, 2))
const errorMessages = ref<string[]>([])
const selectedTemplate = ref<string | null>(null)
const showVariables = ref(false)

const variables = [
  { code: '$date()', desc: 'Fecha actual en formato local' },
  { code: '$time()', desc: 'Hora actual' },
  { code: '$username(default)', desc: 'Nombre de usuario autenticado' },
  { code: '$mcAccountName(default)', desc: 'Cuenta de Minecraft vinculada' },
  { code: '$fetch(url, default)', desc: 'Petición HTTP GET' },
  { code: '$onlinePlayers(host:port)', desc: 'Jugadores online en servidor' },
  { code: '$random(min, max)', desc: 'Número aleatorio' }
]

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
