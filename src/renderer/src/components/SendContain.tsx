import { useDevicesStore } from '@renderer/store/useDevices'
import { Device } from '@renderer/types/preload'
import { ChangeEvent, useEffect, useState, useRef } from 'react'

interface DeviceItem extends Device {
  selected: boolean
}

const generateFileHash = (file: File): string => {
  return `${file.name}-${file.size}-${file.lastModified}`
}
// 将文件切片
const createFileChunks = (file: File, chunkSize: number = 5 * 1024 * 1024): Blob[] => {
  const chunks: Blob[] = []
  let cur = 0
  while (cur < file.size) {
    chunks.push(file.slice(cur, cur + chunkSize))
    cur += chunkSize
  }
  return chunks
}
const useDevices = (): {
  devices: DeviceItem[]
  toggleDevice: (id: string) => void
} => {
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const _devices = useDevicesStore((state) => state.devices)
  useEffect(() => {
    console.log(_devices, '设备改变了')
    const tempDevices = _devices.map((device) => ({ ...device, selected: false }))
    setDevices(tempDevices)
  }, [_devices])
  const toggleDevice = (id: string): void => {
    setDevices(
      devices.map((device) =>
        device.id === id ? { ...device, selected: !device.selected } : device
      )
    )
  }
  return {
    devices,
    toggleDevice
  }
}
const useSelectFile = (): {
  selectedFiles: File[]
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void
} => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    console.log(e.target.files)
    const arr = Array.from(e.target?.files ?? [])
    setSelectedFiles(arr)
  }
  return {
    selectedFiles,
    handleFileSelect
  }
}

export const SendContain = (): JSX.Element => {
  const { devices, toggleDevice } = useDevices()
  const { selectedFiles, handleFileSelect } = useSelectFile()
  // 添加状态管理
  const [transferStatus, setTransferStatus] = useState<
    'idle' | 'transferring' | 'paused' | 'completed'
  >('idle')
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>('')
  const transferRef = useRef<boolean>(true)

  // 修改 startTransfer 函数中的合并请求部分
  const startTransfer = async (devices: DeviceItem[], file: File): Promise<void> => {
    const fileHash = generateFileHash(file)
    const chunks = createFileChunks(file)
    setCurrentFile(file.name)

    for (const device of devices.filter((item) => item.selected)) {
      try {
        console.log('开始上传文件:', {
          设备: device.name,
          文件名: file.name,
          文件大小: file.size,
          分片数量: chunks.length,
          文件Hash: fileHash
        })

        // 上传所有分片
        for (let i = 0; i < chunks.length; i++) {
          // 检查是否暂停
          if (!transferRef.current) {
            await new Promise((resolve) => {
              const checkPause = setInterval(() => {
                if (transferRef.current) {
                  clearInterval(checkPause)
                  resolve(true)
                }
              }, 100)
            })
          }

          const formData = new FormData()
          formData.append('chunk', chunks[i], `chunk-${i}`)
          formData.append('fileHash', fileHash)
          formData.append('chunkIndex', i.toString())

          const uploadResponse = await fetch(`http://${device.address}:${50001}/upload/chunk`, {
            method: 'POST',
            body: formData
          })

          const result = await uploadResponse.json()

          if (!uploadResponse.ok || !result.success) {
            throw new Error(`分片 ${i} 上传失败: ${result.message || uploadResponse.statusText}`)
          }

          // 更新进度
          setProgress(((i + 1) / chunks.length) * 100)
          console.log(`分片 ${i} 上传成功:`, result)
        }

        // 等待一小段时间确保文件系统同步
        await new Promise((resolve) => setTimeout(resolve, 500))

        // 请求合并文件
        const mergeResponse = await fetch(`http://${device.address}:${50001}/upload/merge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileHash,
            fileName: file.name,
            totalChunks: chunks.length
          })
        })

        const mergeResult = await mergeResponse.json()

        if (!mergeResponse.ok || !mergeResult.success) {
          throw new Error(`合并失败: ${mergeResult.message || mergeResponse.statusText}`)
        }

        console.log('文件上传完成:', mergeResult)
      } catch (error) {
        console.error('传输过程出错:', error)
        setTransferStatus('idle')
        throw error
      }
    }
  }

  // 修改 onClickStart 函数
  const onClickStart = async (): Promise<void> => {
    try {
      setTransferStatus('transferring')
      transferRef.current = true
      setProgress(0)

      const selectedDevices = devices.filter((item) => item.selected)

      for (const file of selectedFiles) {
        await startTransfer(selectedDevices, file)
      }

      setTransferStatus('completed')
    } catch (error) {
      console.error('传输错误:', error)
      setTransferStatus('idle')
    }
  }

  // 添加控制函数
  const handlePause = (): void => {
    transferRef.current = false
    setTransferStatus('paused')
  }

  const handleResume = (): void => {
    transferRef.current = true
    setTransferStatus('transferring')
  }

  const handleStop = (): void => {
    transferRef.current = false
    setTransferStatus('idle')
    setProgress(0)
    setCurrentFile('')
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Device Selection Section */}
      <div className="bg-neutral-700 p-4 rounded-lg">
        <h2 className="text-lg font-semibold text-neutral-200 mb-3">选择目标设备</h2>
        <div className="grid grid-cols-2 gap-3">
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => toggleDevice(device.id)}
              className={`p-3 rounded-lg text-left ${
                device.selected
                  ? 'bg-amber-500 text-neutral-900'
                  : 'bg-neutral-600 text-neutral-200'
              }`}
            >
              {device.name}
            </button>
          ))}
        </div>
      </div>

      {/* File Selection Section */}
      <div className="bg-neutral-700 p-4 rounded-lg flex-1">
        <h2 className="text-lg font-semibold text-neutral-200 mb-3">选择文件</h2>
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="bg-neutral-600 p-2 rounded text-neutral-200">
              {file.name}
            </div>
          ))}

          <label
            htmlFor="fileInput"
            className="block text-center w-full py-2 bg-neutral-600 text-neutral-200 rounded-lg hover:bg-neutral-500"
          >
            选择文件
          </label>
          <input multiple type="file" id="fileInput" onChange={handleFileSelect}></input>
        </div>
      </div>

      {/* Transfer Controls */}
      <div className="bg-neutral-700 p-4 rounded-lg space-y-4">
        <button
          onClick={onClickStart}
          disabled={
            !devices.some((d) => d.selected) ||
            selectedFiles.length === 0 ||
            transferStatus === 'transferring' ||
            transferStatus === 'paused'
          }
          className="w-full py-2 bg-amber-500 text-neutral-900 rounded-lg hover:bg-amber-400 disabled:bg-neutral-600 disabled:text-neutral-400"
        >
          开始传输
        </button>

        {transferStatus !== 'idle' && (
          <>
            {/* 进度条和文件名 */}
            <div className="space-y-2">
              {currentFile && (
                <div className="text-neutral-200 text-sm">当前文件: {currentFile}</div>
              )}
              <div className="w-full bg-neutral-600 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    transferStatus === 'completed'
                      ? 'bg-green-500'
                      : transferStatus === 'paused'
                        ? 'bg-yellow-500'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="text-neutral-200">
                  {transferStatus === 'completed' && '传输完成'}
                  {transferStatus === 'paused' && '已暂停'}
                  {transferStatus === 'transferring' && '传输中...'}
                </div>
                <div className="text-neutral-200">{Math.round(progress)}%</div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex justify-center space-x-4">
              {transferStatus !== 'completed' && (
                <>
                  {transferStatus === 'transferring' ? (
                    <button
                      onClick={handlePause}
                      disabled={transferStatus !== 'transferring'}
                      className="px-4 py-2 bg-yellow-500 text-neutral-900 rounded-lg hover:bg-yellow-400 disabled:bg-neutral-600 disabled:text-neutral-400"
                    >
                      暂停
                    </button>
                  ) : (
                    <button
                      onClick={handleResume}
                      disabled={transferStatus !== 'paused'}
                      className="px-4 py-2 bg-amber-500 text-neutral-900 rounded-lg hover:bg-amber-400 disabled:bg-neutral-600 disabled:text-neutral-400"
                    >
                      继续
                    </button>
                  )}
                  <button
                    onClick={handleStop}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-400"
                  >
                    停止
                  </button>
                </>
              )}
              {transferStatus === 'completed' && (
                <button
                  onClick={handleStop}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-400"
                >
                  完成
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
