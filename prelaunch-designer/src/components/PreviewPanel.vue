<template>
  <div class="w-full h-full flex flex-col gap-4">
    <div class="flex items-center justify-between px-2">
      <div class="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
        <Monitor class="w-4 h-4 text-primary" />
        <span class="text-xs font-medium text-white/60">Vista de Escritorio</span>
      </div>

      <div v-if="appearance.audio?.url" class="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
        <button @click="audioMuted = !audioMuted" class="text-white/60 hover:text-white transition-colors">
          <VolumeX v-if="audioMuted" class="w-4 h-4" />
          <Volume2 v-else class="w-4 h-4" />
        </button>
        <div class="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-primary" :style="{ width: (appearance.audio?.volume || 0.5) * 100 + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="flex-1 flex items-start justify-center overflow-auto p-4 pt-12" @mousemove="handleMouseMove"
      @mouseup="stopDragging">
      <!-- Audio Element -->
      <audio v-if="appearance.audio?.url" ref="audioPlayer" :src="appearance.audio.url" :muted="audioMuted" autoplay
        loop></audio>

      <div
        class="relative bg-black rounded-[2.5rem] border-[8px] border-white/5 shadow-2xl overflow-hidden transition-all duration-500 w-full aspect-video max-w-5xl"
        ref="previewContainer">
        <!-- Background -->
        <div class="absolute inset-0 z-0">
          <img v-if="appearance.background?.imageUrl" :src="appearance.background.imageUrl"
            class="w-full h-full object-cover" />
          <video v-else-if="appearance.background?.videoUrl" autoplay loop muted playsinline
            class="w-full h-full object-cover">
            <source
              :src="Array.isArray(appearance.background.videoUrl) ? appearance.background.videoUrl[0] : appearance.background.videoUrl"
              type="video/mp4" />
          </video>
          <div v-else class="w-full h-full bg-gradient-to-br from-zinc-900 to-black"></div>
          <div class="absolute inset-0 bg-black/20"></div>
        </div>

        <!-- Content -->
        <div class="absolute inset-0 z-10 pointer-events-none">
          <!-- Logo -->
          <div v-if="appearance.logo?.url" :style="logoStyle" class="pointer-events-auto cursor-move select-none"
            @mousedown="startDragging($event, 'logo')">
            <img :src="appearance.logo.url" class="h-full object-contain pointer-events-none" />
          </div>

          <!-- Custom Blocks -->
          <div v-for="(block, index) in appearance.customBlocks" :key="index"
            class="absolute pointer-events-auto cursor-move hover:outline-2 hover:outline-primary/50 rounded transition-shadow select-none"
            :class="{ 'z-50 ring-2 ring-primary shadow-2xl': draggingIndex === index }"
            :style="getBlockStyle(block, index)" @mousedown="startDragging($event, index)">
            <component :is="block.tagName || 'div'" :class="block.className" v-html="renderBlockContent(block)"
              class="pointer-events-none">
            </component>
          </div>
        </div>

        <!-- UI Layer (Play Button, Footer) -->
        <div class="relative z-20 w-full h-full flex flex-col items-center p-12 pointer-events-none">
          <!-- Play Button -->
          <div class="mt-auto flex flex-col items-center gap-6 pointer-events-auto">
            <button
              class="px-12 py-4 rounded-xl font-bold text-lg shadow-2xl transition-all hover:scale-105 active:scale-95"
              :style="playButtonStyle">
              {{ appearance.playButton?.text || 'Jugar ahora' }}
            </button>

            <p v-if="appearance.footerText" class="text-white/40 text-sm font-medium">
              {{ appearance.footerText }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { storeToRefs } from 'pinia'
import { Monitor, Volume2, VolumeX } from 'lucide-vue-next'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const store = useAppearanceStore()
const { appearance } = storeToRefs(store)

const audioMuted = ref(true)
const audioPlayer = ref<HTMLAudioElement | null>(null)
const previewContainer = ref<HTMLElement | null>(null)

// Drag and Drop State
const draggingIndex = ref<number | 'logo' | null>(null)
const dragOffset = ref({ x: 0, y: 0 })

// Sync volume
watch(() => appearance.value.audio?.volume, (newVolume) => {
  if (audioPlayer.value) {
    audioPlayer.value.volume = newVolume ?? 0.5
  }
}, { immediate: true })

// Handle autoplay restrictions / play state
watch(audioMuted, (isMuted) => {
  if (!isMuted && audioPlayer.value) {
    audioPlayer.value.play().catch(err => console.warn("Audio play failed:", err))
  }
})

const startDragging = (e: MouseEvent, index: number | 'logo') => {
  e.preventDefault()
  draggingIndex.value = index
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }

  // Select the block in the store if it's a custom block
  if (typeof index === 'number') {
    store.selectBlock(appearance.value.customBlocks![index])
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (draggingIndex.value === null || !previewContainer.value) return

  const containerRect = previewContainer.value.getBoundingClientRect()

  // Calculate position relative to container
  let x = e.clientX - containerRect.left - dragOffset.value.x
  let y = e.clientY - containerRect.top - dragOffset.value.y

  // Convert to percentage for better responsiveness
  const leftPercent = (x / containerRect.width) * 100
  const topPercent = (y / containerRect.height) * 100

  if (draggingIndex.value === 'logo') {
    store.updateAppearanceSilent({
      logo: {
        ...appearance.value.logo!,
        position: {
          ...appearance.value.logo?.position,
          left: `${leftPercent.toFixed(2)}%`,
          top: `${topPercent.toFixed(2)}%`,
          right: 'auto',
          bottom: 'auto',
          transform: 'none'
        }
      }
    })
  } else {
    const index = draggingIndex.value as number
    const blocks = [...(appearance.value.customBlocks || [])]
    blocks[index] = {
      ...blocks[index],
      position: {
        ...blocks[index].position,
        left: `${leftPercent.toFixed(2)}%`,
        top: `${topPercent.toFixed(2)}%`,
        right: 'auto',
        bottom: 'auto',
        transform: 'none'
      }
    }
    store.updateAppearanceSilent({ customBlocks: blocks })
  }
}

const stopDragging = () => {
  if (draggingIndex.value !== null) {
    store.commitHistory()
  }
  draggingIndex.value = null
}

const logoStyle = computed(() => {
  const style: any = {
    position: 'absolute' as const,
    height: appearance.value.logo?.height || '56px',
    ...appearance.value.logo?.position,
    zIndex: 20
  }
  if (draggingIndex.value === 'logo') {
    style.transform = 'none'
  }
  return style
})

const playButtonStyle = computed(() => ({
  backgroundColor: appearance.value.playButton?.backgroundColor || '#00a63e',
  color: appearance.value.playButton?.textColor || '#ffffff',
  borderColor: appearance.value.playButton?.borderColor || 'transparent',
  borderWidth: appearance.value.playButton?.borderColor ? '2px' : '0px'
}))

const getBlockStyle = (block: any, index: number) => {
  let style: any = {
    ...block.position,
    zIndex: draggingIndex.value === index ? 100 : (block.position?.zIndex || 10)
  }

  if (draggingIndex.value === index) {
    style.transform = 'none'
    style.right = 'auto'
    style.bottom = 'auto'
  }

  if (block.style) {
    try {
      const customStyle = typeof block.style === 'string' ? JSON.parse(block.style) : block.style
      style = { ...style, ...customStyle }
    } catch (e) { }
  }
  return style
}

const renderBlockContent = (block: any) => {
  const content = block.content || ''
  if (block.renderType === 'markdown') {
    return DOMPurify.sanitize(marked.parse(content) as string)
  } else if (block.renderType === 'html') {
    return DOMPurify.sanitize(content)
  }
  return content
}
</script>

<style scoped></style>
