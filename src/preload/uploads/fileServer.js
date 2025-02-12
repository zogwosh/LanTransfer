const express = require('express')
const multer = require('multer')
const cors = require('cors')
const os = require('os')
const path = require('path')
const fs = require('fs')

// 获取系统下载目录
const getDownloadsFolder = () => {
  switch (process.platform) {
    case 'win32':
      // Windows: 通常是 C:\Users\username\Downloads
      return path.join(os.homedir(), 'Downloads')
    case 'darwin':
      // macOS: /Users/username/Downloads
      return path.join(os.homedir(), 'Downloads')
    case 'linux':
      // Linux: 通常是 /home/username/Downloads
      return path.join(os.homedir(), 'Downloads')
    default:
      // 如果无法确定系统类型，使用默认的下载目录
      return path.join(os.homedir(), 'Downloads')
  }
}

const app = express()

// 添加 body-parser 中间件来解析 JSON
app.use(express.json())

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  console.log('请求头:', req.headers)
  next()
})

app.use(
  cors({
    methods: ['GET', 'POST']
  })
)

// 配置 multer，添加临时目录用于存储分片
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const downloadPath = getDownloadsFolder()
    const tempDir = path.join(downloadPath, '.temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    cb(null, tempDir)
  },
  filename: function (req, file, cb) {
    // 从 field 中获取参数
    const chunkIndex = req.body.chunkIndex || file.originalname.split('-')[1]
    const fileHash = req.body.fileHash || file.originalname.split('-')[0].replace('chunk', '')
    cb(null, `${fileHash}-${chunkIndex}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 100 // 保持单个分片最大100MB
  }
}).single('chunk') // 改为single，因为每次只上传一个分片

// 分片上传接口
app.post('/upload/chunk', (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      console.error('Multer 错误:', err)
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Multer错误: ${err.code}`,
          error: err.message
        })
      }
      return res.status(500).json({
        success: false,
        message: '分片上传错误',
        error: err.message
      })
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有接收到文件分片'
      })
    }

    // 从请求体中获取参数
    const fileHash = req.body.fileHash
    const chunkIndex = req.body.chunkIndex

    if (!fileHash || chunkIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数',
        required: {
          fileHash: !!fileHash,
          chunkIndex: chunkIndex !== undefined
        }
      })
    }

    // 重命名文件
    const downloadPath = getDownloadsFolder()
    const tempDir = path.join(downloadPath, '.temp')
    const targetPath = path.join(tempDir, `${fileHash}-${chunkIndex}`)

    try {
      fs.renameSync(req.file.path, targetPath)

      console.log('分片信息:', {
        原始路径: req.file.path,
        目标路径: targetPath,
        是否存在: fs.existsSync(targetPath),
        文件大小: req.file.size,
        原始文件名: req.file.originalname,
        MIME类型: req.file.mimetype,
        请求体: req.body
      })

      res.json({
        success: true,
        message: '分片上传成功',
        chunkIndex: chunkIndex,
        savedPath: targetPath,
        fileInfo: {
          size: req.file.size,
          path: targetPath,
          filename: path.basename(targetPath)
        }
      })
    } catch (error) {
      console.error('保存分片失败:', error)
      return res.status(500).json({
        success: false,
        message: '保存分片失败',
        error: error.message
      })
    }
  })
})

// 合并分片接口
app.post('/upload/merge', async (req, res) => {
  console.log('收到合并请求，请求体:', req.body)
  const { fileHash, fileName, totalChunks } = req.body

  // 验证必要参数
  if (!fileHash || !fileName || totalChunks === undefined) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数',
      required: {
        fileHash: !!fileHash,
        fileName: !!fileName,
        totalChunks: !!totalChunks
      }
    })
  }

  const downloadPath = getDownloadsFolder()
  const tempDir = path.join(downloadPath, '.temp')
  const filePath = path.join(downloadPath, fileName)

  // 检查临时目录
  if (!fs.existsSync(tempDir)) {
    return res.status(400).json({
      success: false,
      message: '临时目录不存在'
    })
  }

  // 检查所有分片是否存在
  const missingChunks = []
  const existingChunks = []
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tempDir, `${fileHash}-${i}`)
    if (!fs.existsSync(chunkPath)) {
      missingChunks.push(i)
    } else {
      existingChunks.push({
        index: i,
        size: fs.statSync(chunkPath).size
      })
    }
  }

  console.log('分片检查结果:', {
    总分片数: totalChunks,
    已存在分片: existingChunks,
    缺失分片: missingChunks,
    临时目录内容: fs.readdirSync(tempDir)
  })

  if (missingChunks.length > 0) {
    return res.status(400).json({
      success: false,
      message: `缺少分片: ${missingChunks.join(', ')}`,
      missingChunks,
      existingChunks
    })
  }

  try {
    // 创建写入流
    const writeStream = fs.createWriteStream(filePath)

    // 按顺序合并分片
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `${fileHash}-${i}`)
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath)
        readStream.pipe(writeStream, { end: false })
        readStream.on('end', resolve)
        readStream.on('error', reject)
      })
      // 删除分片
      fs.unlinkSync(chunkPath)
    }

    writeStream.end()
    res.json({
      success: true,
      message: '文件合并成功',
      fileName: fileName,
      filePath: filePath
    })
  } catch (error) {
    console.error('合并文件错误:', error)
    res.status(500).json({
      success: false,
      message: '合并文件失败',
      error: error.message
    })
  }
})

// 验证分片是否已上传的接口
app.post('/upload/verify', (req, res) => {
  const { fileHash, chunkIndex } = req.body
  const downloadPath = getDownloadsFolder()
  const tempDir = path.join(downloadPath, '.temp')
  const chunkPath = path.join(tempDir, `${fileHash}-${chunkIndex}`)

  res.json({
    exists: fs.existsSync(chunkPath)
  })
})

// 使用自定义的错误处理包装上传中间件
app.post('/upload', (req, res) => {
  console.log('收到上传请求')

  upload(req, res, function (err) {
    if (err) {
      console.error('Multer 错误:', err)
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Multer错误: ${err.code}`,
          error: err.message
        })
      }
      return res.status(500).json({
        success: false,
        message: '文件上传错误',
        error: err.message
      })
    }

    console.log('请求体:', req.body)
    console.log('文件信息:', req.files)

    try {
      if (!req.files || req.files.length === 0) {
        console.error('没有接收到文件')
        return res.status(400).json({
          success: false,
          message: '没有接收到文件'
        })
      }

      res.json({
        success: true,
        message: '文件上传成功',
        files: req.files.map((file) => ({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size
        }))
      })
    } catch (error) {
      console.error('处理文件错误:', error)
      res.status(500).json({
        success: false,
        message: '处理文件失败',
        error: error.message
      })
    }
  })
})

// 添加错误处理中间件
app.use((error, req, res) => {
  console.error('服务器错误：', error)

  if (error instanceof multer.MulterError) {
    // Multer 具体错误处理
    let message = '文件上传错误'
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = '文件大小超过限制（100MB）'
        break
      case 'LIMIT_FILE_COUNT':
        message = '超过最大文件数量限制（10个）'
        break
      case 'LIMIT_UNEXPECTED_FILE':
        message = '未预期的文件字段'
        break
      default:
        message = error.message
    }

    res.status(400).json({
      success: false,
      message,
      error: error.code,
      field: error.field
    })
  } else {
    // 其他错误
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// 添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常：', error)
})

process.on('unhandledRejection', (error) => {
  console.error('未处理的 Promise 拒绝：', error)
})

// 启动服务器时的详细日志
app.listen(50001, () => {
  console.log('=================================')
  console.log('文件服务器配置信息：')
  console.log('---------------------------------')
  console.log('50001')
  console.log('允许的域名：http://localhost:50001')
  console.log('文件保存位置：' + getDownloadsFolder())
  console.log('分片临时目录：' + path.join(getDownloadsFolder(), '.temp'))
  console.log('单个分片大小限制：100MB')
  console.log('=================================')
})
