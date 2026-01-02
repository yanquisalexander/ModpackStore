<template>
  <div class="space-y-6">
    <!-- General -->
    <section class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">General</label>
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Título</span>
            <input v-model="appearance.title" @input="updateAppearance"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="Mi Servidor" />
          </div>
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Descripción</span>
            <textarea v-model="appearance.description" @input="updateAppearance" rows="3"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="La mejor experiencia..."></textarea>
          </div>
        </div>
      </div>
    </section>

    <!-- Logo -->
    <section class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">Logo</label>
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">URL del Logo</span>
            <input v-model="logoUrl" @input="updateLogo"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="https://..." />
          </div>
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Altura</span>
            <input v-model="logoHeight" @input="updateLogo"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="56px" />
          </div>
        </div>
      </div>
    </section>

    <!-- Fondo -->
    <section class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">Fondo</label>
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Imagen URL</span>
            <input v-model="backgroundImageUrl" @input="updateBackground"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="https://..." />
          </div>
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Video URL</span>
            <input v-model="backgroundVideoUrl" @input="updateBackground"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="https://..." />
          </div>
        </div>
      </div>
    </section>

    <!-- Audio -->
    <section class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">Audio</label>
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">URL del Audio</span>
            <input v-model="audioUrl" @input="updateAudio"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="https://..." />
          </div>
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-white/90">Volumen</span>
              <span class="text-xs text-white/60">{{ audioVolumeDisplay }}%</span>
            </div>
            <input type="range" v-model="audioVolumeDisplay" @input="updateAudio" min="0" max="100"
              class="w-full accent-primary" />
          </div>
        </div>
      </div>
    </section>

    <!-- Botón Jugar -->
    <section class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-bold text-white/60 uppercase tracking-wider">Botón Jugar</label>
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-sm font-medium text-white/90">Texto</span>
            <input v-model="playButtonText" @input="updatePlayButton"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <span class="text-sm font-medium text-white/90">Fondo</span>
              <div class="flex gap-2">
                <input type="color" v-model="playButtonBg" @input="updatePlayButton"
                  class="w-8 h-8 rounded border-none bg-transparent cursor-pointer" />
                <input v-model="playButtonBg" @input="updatePlayButton"
                  class="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" />
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-sm font-medium text-white/90">Texto</span>
              <div class="flex gap-2">
                <input type="color" v-model="playButtonTextCol" @input="updatePlayButton"
                  class="w-8 h-8 rounded border-none bg-transparent cursor-pointer" />
                <input v-model="playButtonTextCol" @input="updatePlayButton"
                  class="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAppearanceStore } from '@/store/appearance'

const store = useAppearanceStore()
const appearance = computed(() => store.appearance)

// Local state for nested properties
const logoUrl = ref(appearance.value.logo?.url || '')
const logoHeight = ref(appearance.value.logo?.height || '56px')
const backgroundImageUrl = ref(appearance.value.background?.imageUrl || '')
const backgroundVideoUrl = ref(appearance.value.background?.videoUrl || '')
const audioUrl = ref(appearance.value.audio?.url || '')
const audioVolumeDisplay = ref(Math.round((appearance.value.audio?.volume || 0.5) * 100))
const playButtonText = ref(appearance.value.playButton?.text || 'Jugar ahora')
const playButtonBg = ref(appearance.value.playButton?.backgroundColor || '#00a63e')
const playButtonTextCol = ref(appearance.value.playButton?.textColor || '#ffffff')

// Watch for store changes to update local state
watch(() => store.appearance, (newVal) => {
  logoUrl.value = newVal.logo?.url || ''
  logoHeight.value = newVal.logo?.height || '56px'
  backgroundImageUrl.value = newVal.background?.imageUrl || ''
  backgroundVideoUrl.value = newVal.background?.videoUrl || ''
  audioUrl.value = newVal.audio?.url || ''
  audioVolumeDisplay.value = Math.round((newVal.audio?.volume || 0.5) * 100)
  playButtonText.value = newVal.playButton?.text || 'Jugar ahora'
  playButtonBg.value = newVal.playButton?.backgroundColor || '#00a63e'
  playButtonTextCol.value = newVal.playButton?.textColor || '#ffffff'
}, { deep: true })

const updateAppearance = () => {
  store.updateAppearance({ ...appearance.value })
}

const updateLogo = () => {
  store.updateAppearance({
    ...appearance.value,
    logo: {
      ...appearance.value.logo,
      url: logoUrl.value,
      height: logoHeight.value
    }
  })
}

const updateBackground = () => {
  store.updateAppearance({
    ...appearance.value,
    background: {
      ...appearance.value.background,
      imageUrl: backgroundImageUrl.value,
      videoUrl: backgroundVideoUrl.value
    }
  })
}

const updateAudio = () => {
  store.updateAppearance({
    ...appearance.value,
    audio: {
      ...appearance.value.audio,
      url: audioUrl.value,
      volume: audioVolumeDisplay.value / 100
    }
  })
}

const updatePlayButton = () => {
  store.updateAppearance({
    ...appearance.value,
    playButton: {
      ...appearance.value.playButton,
      text: playButtonText.value,
      backgroundColor: playButtonBg.value,
      textColor: playButtonTextCol.value
    }
  })
}
</script>

<style scoped></style>
