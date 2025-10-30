import { defineStore } from 'pinia'
import type { PreLaunchAppearance, CustomBlock } from '@/types/PreLaunchAppearance'

export const useAppearanceStore = defineStore('appearance', {
  state: () => ({
    appearance: {
      title: '',
      description: '',
      customBlocks: []
    } as PreLaunchAppearance,
    selectedBlock: null as CustomBlock | null,
    editMode: 'visual' as 'visual' | 'advanced',
    history: [] as PreLaunchAppearance[],
    historyIndex: -1,
    showAppBar: true
  }),

  getters: {
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex < state.history.length - 1,
    jsonString: (state) => JSON.stringify(state.appearance, null, 2)
  },

  actions: {
    setAppearance(appearance: PreLaunchAppearance) {
      this.appearance = appearance
      this.addToHistory()
    },

    updateAppearance(partial: Partial<PreLaunchAppearance>) {
      this.appearance = { ...this.appearance, ...partial }
      this.addToHistory()
    },

    addCustomBlock(block: CustomBlock) {
      if (!this.appearance.customBlocks) {
        this.appearance.customBlocks = []
      }
      this.appearance.customBlocks.push(block)
      this.addToHistory()
    },

    updateCustomBlock(index: number, block: CustomBlock) {
      if (this.appearance.customBlocks && this.appearance.customBlocks[index]) {
        this.appearance.customBlocks[index] = block
        this.addToHistory()
      }
    },

    removeCustomBlock(index: number) {
      if (this.appearance.customBlocks) {
        this.appearance.customBlocks.splice(index, 1)
        if (this.selectedBlock && this.appearance.customBlocks.indexOf(this.selectedBlock) === -1) {
          this.selectedBlock = null
        }
        this.addToHistory()
      }
    },

    moveCustomBlock(fromIndex: number, toIndex: number) {
      if (this.appearance.customBlocks) {
        const block = this.appearance.customBlocks.splice(fromIndex, 1)[0]
        this.appearance.customBlocks.splice(toIndex, 0, block)
        this.addToHistory()
      }
    },

    selectBlock(block: CustomBlock | null) {
      this.selectedBlock = block
    },

    setEditMode(mode: 'visual' | 'advanced') {
      this.editMode = mode
    },

    setShowAppBar(show: boolean) {
      this.showAppBar = show
    },

    importFromJSON(jsonString: string) {
      try {
        const parsed = JSON.parse(jsonString)
        this.setAppearance(parsed)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Invalid JSON' }
      }
    },

    exportToJSON(): string {
      return JSON.stringify(this.appearance, null, 2)
    },

    addToHistory() {
      // Remove any future history if we're not at the end
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }

      // Add current state to history
      this.history.push(JSON.parse(JSON.stringify(this.appearance)))
      this.historyIndex++

      // Limit history to 50 items
      if (this.history.length > 50) {
        this.history.shift()
        this.historyIndex--
      }
    },

    undo() {
      if (this.canUndo) {
        this.historyIndex--
        this.appearance = JSON.parse(JSON.stringify(this.history[this.historyIndex]))
      }
    },

    redo() {
      if (this.canRedo) {
        this.historyIndex++
        this.appearance = JSON.parse(JSON.stringify(this.history[this.historyIndex]))
      }
    },

    reset() {
      this.appearance = {
        title: '',
        description: '',
        customBlocks: []
      }
      this.selectedBlock = null
      this.history = []
      this.historyIndex = -1
      this.addToHistory()
    }
  }
})
