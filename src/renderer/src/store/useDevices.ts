import { create } from 'zustand'
import type { Device } from '../types/preload'

interface DevicesState {
  devices: Device[]
  setDevices: (devices: Device[]) => void
  addDevice: (device: Device) => void
  removeDevice: (deviceId: string) => void
}

export const useDevicesStore = create<DevicesState>((set) => ({
  devices: [
    {
      id: '1',
      name: '1',
      address: 'localhost',
      port: 50001,
      lastSeen: Date.now()
    }
  ],

  setDevices: (devices: Device[]): void => {
    set({ devices })
  },

  addDevice: (device: Device): void => {
    set((state) => ({
      devices: [...state.devices.filter((d) => d.id !== device.id), device]
    }))
  },

  removeDevice: (deviceId: string): void => {
    set((state) => ({
      devices: state.devices.filter((device) => device.id !== deviceId)
    }))
  }
}))
