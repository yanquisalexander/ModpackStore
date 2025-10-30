<template>
  <v-card flat tile height="100%" class="preview-container">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>Vista Previa</span>
      <v-btn-group density="compact">
        <v-btn
          icon="mdi-monitor"
          :variant="previewMode === 'desktop' ? 'tonal' : 'text'"
          @click="previewMode = 'desktop'"
        >
          <v-icon>mdi-monitor</v-icon>
          <v-tooltip activator="parent">Escritorio</v-tooltip>
        </v-btn>
        <v-btn
          icon="mdi-tablet"
          :variant="previewMode === 'tablet' ? 'tonal' : 'text'"
          @click="previewMode = 'tablet'"
        >
          <v-icon>mdi-tablet</v-icon>
          <v-tooltip activator="parent">Tablet</v-tooltip>
        </v-btn>
        <v-btn
          icon="mdi-cellphone"
          :variant="previewMode === 'mobile' ? 'tonal' : 'text'"
          @click="previewMode = 'mobile'"
        >
          <v-icon>mdi-cellphone</v-icon>
          <v-tooltip activator="parent">Móvil</v-tooltip>
        </v-btn>
      </v-btn-group>
    </v-card-title>

    <v-card-text class="pa-0 preview-wrapper">
      <div 
        class="preview-frame"
        :class="previewModeClass"
      >
        <div class="preview-content">
          <!-- Background -->
          <div v-if="appearance.background?.imageUrl" class="preview-background">
            <img 
              :src="appearance.background.imageUrl" 
              alt="Background"
              class="background-image"
            />
          </div>
          <div v-else-if="appearance.background?.videoUrl" class="preview-background">
            <div class="background-placeholder">
              <v-icon size="64">mdi-video</v-icon>
              <p>Video Background</p>
            </div>
          </div>
          <div v-else class="preview-background default-background"></div>

          <!-- Logo -->
          <div 
            v-if="appearance.logo?.url"
            class="preview-logo"
            :style="logoStyle"
          >
            <img :src="appearance.logo.url" alt="Logo" />
          </div>

          <!-- Custom Blocks -->
          <div
            v-for="(block, index) in appearance.customBlocks"
            :key="index"
            class="preview-block"
            :class="block.className"
            :style="getBlockStyle(block)"
          >
            <component
              :is="block.tagName || 'div'"
              v-html="renderBlockContent(block)"
            ></component>
          </div>

          <!-- Play Button -->
          <div class="preview-footer">
            <button
              class="preview-play-button"
              :style="playButtonStyle"
            >
              {{ appearance.playButton?.text || 'Jugar ahora' }}
            </button>

            <!-- Footer Text -->
            <p v-if="appearance.footerText" class="preview-footer-text">
              {{ appearance.footerText }}
            </p>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { storeToRefs } from 'pinia'
import type { CustomBlock } from '@/types/PreLaunchAppearance'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const store = useAppearanceStore()
const { appearance } = storeToRefs(store)

const previewMode = ref<'desktop' | 'tablet' | 'mobile'>('desktop')

const previewModeClass = computed(() => {
  switch (previewMode.value) {
    case 'tablet':
      return 'preview-tablet'
    case 'mobile':
      return 'preview-mobile'
    default:
      return 'preview-desktop'
  }
})

const logoStyle = computed(() => {
  const logo = appearance.value.logo
  if (!logo) return {}

  return {
    position: 'absolute',
    height: logo.height || '56px',
    top: logo.position?.top,
    left: logo.position?.left,
    right: logo.position?.right,
    bottom: logo.position?.bottom,
    transform: logo.position?.transform
  }
})

const playButtonStyle = computed(() => {
  const btn = appearance.value.playButton
  if (!btn) return {}

  return {
    backgroundColor: btn.backgroundColor || '#00a63e',
    color: btn.textColor || '#ffffff',
    borderColor: btn.borderColor || '#ffffff'
  }
})

const getBlockStyle = (block: CustomBlock) => {
  const style: Record<string, any> = {}

  if (block.position) {
    style.position = 'absolute'
    if (block.position.top) style.top = block.position.top
    if (block.position.left) style.left = block.position.left
    if (block.position.right) style.right = block.position.right
    if (block.position.bottom) style.bottom = block.position.bottom
    if (block.position.transform) style.transform = block.position.transform
    if (block.position.zIndex) style.zIndex = block.position.zIndex
  }

  if (block.zIndex && !block.position?.zIndex) {
    style.zIndex = block.zIndex
  }

  // Parse additional styles from style string
  if (block.style) {
    try {
      const parsedStyle = JSON.parse(block.style)
      Object.assign(style, parsedStyle)
    } catch (e) {
      console.warn('Invalid style JSON:', block.style)
    }
  }

  return style
}

const renderBlockContent = (block: CustomBlock): string => {
  if (!block.content) return ''

  switch (block.renderType) {
    case 'html':
      return DOMPurify.sanitize(block.content)
    case 'markdown':
      return DOMPurify.sanitize(marked.parse(block.content) as string)
    case 'text':
      return DOMPurify.sanitize(block.content.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    case 'auto':
    default:
      // Auto-detect: if contains markdown syntax, use markdown
      if (/[*_`~\[\]()#]/.test(block.content)) {
        return DOMPurify.sanitize(marked.parse(block.content) as string)
      }
      return DOMPurify.sanitize(block.content.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
  }
}
</script>

<style scoped>
.preview-container {
  background: #121212;
  overflow: hidden;
}

.preview-wrapper {
  height: calc(100vh - 128px);
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.preview-frame {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
  position: relative;
}

.preview-desktop {
  width: 100%;
  height: 100%;
  max-width: 1920px;
  aspect-ratio: 16 / 9;
}

.preview-tablet {
  width: 768px;
  height: 1024px;
}

.preview-mobile {
  width: 375px;
  height: 667px;
}

.preview-content {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.preview-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.background-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.default-background {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

.preview-logo {
  z-index: 10;
}

.preview-logo img {
  max-width: 100%;
  height: auto;
}

.preview-block {
  z-index: 5;
}

.preview-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.5);
}

.preview-play-button {
  padding: 1rem 3rem;
  font-size: 1.125rem;
  font-weight: 600;
  border: 2px solid;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.preview-play-button:hover {
  transform: scale(1.05);
}

.preview-footer-text {
  margin: 0;
  color: white;
  font-size: 0.875rem;
  text-align: center;
}
</style>
