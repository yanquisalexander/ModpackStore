<template>
  <v-app>
    <v-app-bar v-show="store.showAppBar" color="primary" prominent>
      <v-app-bar-title>
        <v-icon icon="mdi-rocket-launch" class="mr-2"></v-icon>
        Prelaunch Designer
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <v-btn icon="mdi-theme-light-dark" @click="toggleTheme"></v-btn>
      <v-btn icon="mdi-help-circle-outline" href="https://github.com/yanquisalexander/ModpackStore"
        target="_blank"></v-btn>
    </v-app-bar>

    <v-main :class="{ 'pa-0': !store.showAppBar }">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useAppearanceStore } from '@/store/appearance'

const theme = useTheme()
const store = useAppearanceStore()

const toggleTheme = () => {
  theme.global.name.value = theme.global.name.value === 'dark' ? 'light' : 'dark'
}
</script>

<style scoped></style>
