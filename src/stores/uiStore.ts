import { create } from 'zustand';

type UiState = {
  screen: string;
  searchQuery: string;
  setScreen: (screen: string) => void;
  setSearchQuery: (query: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  screen: 'لوحة التحكم',
  searchQuery: '',
  setScreen: (screen) => set({ screen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
