import { useMenuStore, DEFAULT_MENU_ITEMS } from '@renderer/store/useMenu'
import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps): ReactNode => {
  const updateSelectedItem = useMenuStore((state) => state.updateSelectedItem)
  const selectedItem = useMenuStore((state) => state.selectedItem)

  return (
    <div className="flex w-full h-screen">
      {/* Left Sidebar */}
      <div className="w-64 h-full bg-neutral-900 border-r border-neutral-700">
        <div className="p-4">
          <h1 className="text-xl font-bold text-amber-500">Directory</h1>
          {/* Add your directory content here */}
          {/* 循环DEFAULT_MENU_ITEMS */}
          <nav className="mt-4 space-y-2">
            {DEFAULT_MENU_ITEMS.map((item) => (
              <a
                key={item.id}
                href="#"
                className={`block px-4 py-2 text-neutral-300 hover:bg-neutral-800 rounded ${
                  selectedItem?.id === item.id ? 'bg-neutral-800 text-amber-500' : ''
                }`}
                onClick={() => updateSelectedItem(item)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full bg-neutral-800 overflow-auto">
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
