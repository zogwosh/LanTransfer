import dgram from 'dgram'
import os from 'os'

const MULTICAST_ADDR = '224.0.0.251'
const BROADCAST_ADDR = '255.255.255.255'
const BROADCAST_PORT = 41234

interface Device {
  id: string
  name: string
  address: string
  port: number
  lastSeen: number
}

interface DeviceFinderOptions {
  deviceId: string
  deviceName: string
  onDeviceFound?: (device: Device) => void
  onDeviceOffline?: (device: Device) => void
  onDevicesChanged?: (devices: Device[]) => void
}

export function createDeviceFinder({
  deviceId,
  deviceName,
  onDeviceFound,
  onDeviceOffline,
  onDevicesChanged
}: DeviceFinderOptions): {
  init: () => Promise<void>
  start: () => void
  stop: () => void
  getDevices: () => Device[]
} {
  const socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
  })

  const devices = new Map<string, Device>()
  const localIPs = getLocalIPs()
  let isRunning = false
  let broadcastInterval: NodeJS.Timeout
  let cleanupInterval: NodeJS.Timeout

  function getLocalIPs(): string[] {
    const interfaces = os.networkInterfaces()
    const addresses: string[] = []
    for (const iface of Object.values(interfaces)) {
      for (const addr of iface!) {
        if (addr.family === 'IPv4' && !addr.internal) {
          addresses.push(addr.address)
        }
      }
    }
    return addresses
  }

  function initSocket(): Promise<void> {
    return new Promise((resolve) => {
      socket.on('listening', () => {
        socket.setBroadcast(true)
        socket.addMembership(MULTICAST_ADDR)
        resolve()
      })

      socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString())

          if (data.type === 'discovery' && data.id !== deviceId) {
            const isNewDevice = !devices.has(data.id)

            const device: Device = {
              id: data.id,
              name: data.name,
              address: rinfo.address,
              port: rinfo.port,
              lastSeen: Date.now()
            }

            devices.set(data.id, device)

            if (isNewDevice) {
              onDeviceFound?.(device)
              onDevicesChanged?.(Array.from(devices.values()))
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err)
        }
      })

      socket.bind(BROADCAST_PORT)
    })
  }

  function startBroadcast(): void {
    if (isRunning) return

    isRunning = true
    const broadcastMessage = {
      type: 'discovery',
      id: deviceId,
      name: deviceName,
      timestamp: Date.now()
    }

    // 清理离线设备
    cleanupInterval = setInterval(() => {
      const now = Date.now()
      let hasOfflineDevices = false

      devices.forEach((device, id) => {
        if (now - device.lastSeen > 10000) {
          onDeviceOffline?.(device)
          devices.delete(id)
          hasOfflineDevices = true
        }
      })

      if (hasOfflineDevices) {
        onDevicesChanged?.(Array.from(devices.values()))
      }
    }, 5000)

    // 广播消息
    broadcastInterval = setInterval(() => {
      const message = Buffer.from(JSON.stringify(broadcastMessage))

      // 发送到多播地址
      socket.send(message, 0, message.length, BROADCAST_PORT, MULTICAST_ADDR)

      // 对每个网络接口发送广播
      localIPs.forEach((ip) => {
        const broadcastAddr = ip.split('.').slice(0, 3).concat(['255']).join('.')
        socket.send(message, 0, message.length, BROADCAST_PORT, broadcastAddr)
      })

      // 发送到通用广播地址
      socket.send(message, 0, message.length, BROADCAST_PORT, BROADCAST_ADDR)
    }, 1000)
  }

  function stop(): void {
    if (!isRunning) return

    isRunning = false
    clearInterval(broadcastInterval)
    clearInterval(cleanupInterval)
    socket.close()
  }

  function getDevices(): Device[] {
    return Array.from(devices.values())
  }

  // 初始化并返回控制接口
  return {
    init: initSocket,
    start: startBroadcast,
    stop,
    getDevices
  }
}

// 使用示例：
/*
const finder = createDeviceFinder({
  deviceId: 'device-1',
  deviceName: 'My Device',
  onDeviceFound: (device) => {
    console.log('New device found:', device)
  },
  onDeviceOffline: (device) => {
    console.log('Device went offline:', device)
  },
  onDevicesChanged: (devices) => {
    console.log('Devices list updated:', devices)
  }
})

// 初始化并启动
await finder.init()
finder.start()

// 停止
// finder.stop()
*/
