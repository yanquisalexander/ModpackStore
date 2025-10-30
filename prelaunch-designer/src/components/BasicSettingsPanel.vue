<template>
  <v-container>
    <v-text-field
      v-model="appearance.title"
      label="Título"
      variant="outlined"
      density="comfortable"
      @update:model-value="updateAppearance"
    ></v-text-field>

    <v-textarea
      v-model="appearance.description"
      label="Descripción"
      variant="outlined"
      density="comfortable"
      rows="3"
      @update:model-value="updateAppearance"
    ></v-textarea>

    <v-divider class="my-4"></v-divider>

    <h3 class="text-subtitle-1 mb-2">Logo</h3>
    <v-text-field
      v-model="logoUrl"
      label="URL del Logo"
      variant="outlined"
      density="comfortable"
      @update:model-value="updateLogo"
    ></v-text-field>

    <v-text-field
      v-model="logoHeight"
      label="Altura del Logo"
      variant="outlined"
      density="comfortable"
      placeholder="56px"
      @update:model-value="updateLogo"
    ></v-text-field>

    <v-divider class="my-4"></v-divider>

    <h3 class="text-subtitle-1 mb-2">Fondo</h3>
    <v-text-field
      v-model="backgroundImageUrl"
      label="URL de Imagen de Fondo"
      variant="outlined"
      density="comfortable"
      @update:model-value="updateBackground"
    ></v-text-field>

    <v-text-field
      v-model="backgroundVideoUrl"
      label="URL de Video de Fondo"
      variant="outlined"
      density="comfortable"
      @update:model-value="updateBackground"
    ></v-text-field>

    <v-divider class="my-4"></v-divider>

    <h3 class="text-subtitle-1 mb-2">Botón de Jugar</h3>
    <v-text-field
      v-model="playButtonText"
      label="Texto del Botón"
      variant="outlined"
      density="comfortable"
      @update:model-value="updatePlayButton"
    ></v-text-field>

    <v-row>
      <v-col cols="6">
        <v-text-field
          v-model="playButtonBgColor"
          label="Color de Fondo"
          variant="outlined"
          density="comfortable"
          type="color"
          @update:model-value="updatePlayButton"
        ></v-text-field>
      </v-col>
      <v-col cols="6">
        <v-text-field
          v-model="playButtonTextColor"
          label="Color de Texto"
          variant="outlined"
          density="comfortable"
          type="color"
          @update:model-value="updatePlayButton"
        ></v-text-field>
      </v-col>
    </v-row>

    <v-divider class="my-4"></v-divider>

    <h3 class="text-subtitle-1 mb-2">Footer</h3>
    <v-text-field
      v-model="footerText"
      label="Texto del Footer"
      variant="outlined"
      density="comfortable"
      @update:model-value="updateFooter"
    ></v-text-field>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { storeToRefs } from 'pinia'

const store = useAppearanceStore()
const { appearance } = storeToRefs(store)

// Local refs for form fields
const logoUrl = ref(appearance.value.logo?.url || '')
const logoHeight = ref(appearance.value.logo?.height || '56px')
const backgroundImageUrl = ref(appearance.value.background?.imageUrl || '')
const backgroundVideoUrl = ref(appearance.value.background?.videoUrl as string || '')
const playButtonText = ref(appearance.value.playButton?.text || 'Jugar ahora')
const playButtonBgColor = ref(appearance.value.playButton?.backgroundColor || '#00a63e')
const playButtonTextColor = ref(appearance.value.playButton?.textColor || '#ffffff')
const footerText = ref(appearance.value.footerText || '')

// Watch for store changes
watch(appearance, (newVal) => {
  logoUrl.value = newVal.logo?.url || ''
  logoHeight.value = newVal.logo?.height || '56px'
  backgroundImageUrl.value = newVal.background?.imageUrl || ''
  backgroundVideoUrl.value = newVal.background?.videoUrl as string || ''
  playButtonText.value = newVal.playButton?.text || 'Jugar ahora'
  playButtonBgColor.value = newVal.playButton?.backgroundColor || '#00a63e'
  playButtonTextColor.value = newVal.playButton?.textColor || '#ffffff'
  footerText.value = newVal.footerText || ''
}, { deep: true })

const updateAppearance = () => {
  store.updateAppearance({
    title: appearance.value.title,
    description: appearance.value.description
  })
}

const updateLogo = () => {
  store.updateAppearance({
    logo: {
      ...appearance.value.logo,
      url: logoUrl.value,
      height: logoHeight.value,
      position: appearance.value.logo?.position || {
        top: '8rem',
        left: '50%',
        transform: 'translateX(-50%)'
      }
    }
  })
}

const updateBackground = () => {
  store.updateAppearance({
    background: {
      imageUrl: backgroundImageUrl.value || undefined,
      videoUrl: backgroundVideoUrl.value || undefined
    }
  })
}

const updatePlayButton = () => {
  store.updateAppearance({
    playButton: {
      ...appearance.value.playButton,
      text: playButtonText.value,
      backgroundColor: playButtonBgColor.value,
      textColor: playButtonTextColor.value
    }
  })
}

const updateFooter = () => {
  store.updateAppearance({
    footerText: footerText.value
  })
}
</script>
