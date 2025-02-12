import { create } from 'zustand'

interface MenuItem {
  id: string
  label: string
}

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'send',
    label: '发送'
  },
  {
    id: 'receive',
    label: '接收'
  }
]

interface MenuState {
  selectedItem: MenuItem | null
  menuItems: MenuItem[]
  updateSelectedItem: (item: MenuItem) => void
}

export const useMenuStore = create<MenuState>((set) => ({
  selectedItem: DEFAULT_MENU_ITEMS[0],
  menuItems: DEFAULT_MENU_ITEMS,
  updateSelectedItem: (item: MenuItem): void => set({ selectedItem: item })
}))
