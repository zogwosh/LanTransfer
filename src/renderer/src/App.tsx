import { ReactNode, useEffect } from 'react'
import { Layout } from './components/Layout'
import { useMenuStore } from './store/useMenu'
import { SendContain } from './components/SendContain'
import { useDeviceFinder } from './hooks/useDeviceFinder'
const opt = {
  deviceId: Math.random().toString(36).substring(2, 10),
  deviceName: `设备-${Math.random().toString(36).substring(2, 6)}`
}
function App(): ReactNode {
  const selectedItem = useMenuStore((state) => state.selectedItem)
  useDeviceFinder(opt)
  useEffect(() => {
    const fileServer = window.api.createFileServer()

    fileServer.start()
  }, [])
  return (
    <>
      <Layout>
        {selectedItem?.id === 'send' && <SendContain />}
        <div></div>
      </Layout>
    </>
  )
}

export default App
