import { useEffect } from 'react'
import { useDevicesStore } from '../store/useDevices'

interface DeviceFinderOptions {
  deviceId: string
  deviceName: string
}

export const useDeviceFinder = ({ deviceId, deviceName }: DeviceFinderOptions): void => {
  const { addDevice, removeDevice, setDevices } = useDevicesStore()

  useEffect(() => {
    const finder = window.api.createDeviceFinder({
      deviceId,
      deviceName,
      onDeviceFound: (device) => {
        console.log('New device found:', device)
        addDevice(device)
      },
      onDeviceOffline: (device) => {
        console.log('Device went offline:', device)
        removeDevice(device.id)
      },
      onDevicesChanged: (devices) => {
        console.log('Devices list updated:', devices)
        setDevices(devices)
      }
    })

    // Initialize and start the finder
    const initFinder = async (): Promise<void> => {
      await finder.init()
      finder.start()
    }
    initFinder()

    // Cleanup function
    return (): void => {
      finder.stop()
    }
  }, [deviceId, deviceName, addDevice, removeDevice, setDevices])
}
