<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
    <header v-show="store.showAppBar"
      class="glass-dark border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Rocket class="w-6 h-6 text-white" />
        </div>
        <h1 class="text-xl font-bold tracking-tight">Prelaunch Designer</h1>
      </div>

      <div class="flex items-center gap-2">
        <a href="https://github.com/yanquisalexander/ModpackStore" target="_blank"
          class="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <Github class="w-5 h-5" />
        </a>
      </div>
    </header>

    <main class="flex-1 flex flex-col overflow-hidden">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppearanceStore } from '@/store/appearance'
import { Rocket, Github } from 'lucide-vue-next'

const store = useAppearanceStore()

onMounted(() => {
  document.documentElement.classList.add('dark')
})
</script>

<style scoped></style>
