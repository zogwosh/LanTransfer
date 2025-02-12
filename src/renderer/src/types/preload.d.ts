export interface Device {
  id: string
  name: string
  address: string
  port: number
  lastSeen: number
}

export interface DeviceFinderOptions {
  deviceId: string
  deviceName: string
  onDeviceFound?: (device: Device) => void
  onDeviceOffline?: (device: Device) => void
  onDevicesChanged?: (devices: Device[]) => void
}

export interface API {
  createDeviceFinder: (options: DeviceFinderOptions) => {
    init: () => Promise<void>
    start: () => void
    stop: () => void
    getDevices: () => Device[]
  }
  createFileServer: (options?: FileServerOptions) => {
    start: () => Promise<void>
    getPort: () => number
    getDownloadsFolder: () => string
  }
}

declare global {
  interface Window {
    api: API
  }
}

declare module '../../../preload/findDevice' {
  export function createDeviceFinder(options: {
    deviceId: string
    deviceName: string
    onDeviceFound?: (device: Device) => void
    onDeviceOffline?: (device: Device) => void
    onDevicesChanged?: (devices: Device[]) => void
  }): DeviceFinder
}
