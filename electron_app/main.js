const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const net = require('net')

const DEV_ROOT_DIR = path.resolve(__dirname, '..')
const RESOURCES_DIR = app.isPackaged ? process.resourcesPath : DEV_ROOT_DIR
const FRONTEND_DIR = app.isPackaged
  ? path.join(RESOURCES_DIR, 'frontend')
  : path.join(DEV_ROOT_DIR, 'frontend')
const BACKEND_DIR = app.isPackaged
  ? path.join(RESOURCES_DIR, 'backend')
  : path.join(DEV_ROOT_DIR, 'backend')
const BUNDLED_BACKEND_RUNTIME_DIR = app.isPackaged
  ? path.join(RESOURCES_DIR, 'backend-runtime')
  : path.join(__dirname, 'bundle', 'backend-runtime')
const RUN_DIR = path.join(app.getPath('userData'), '.run')
const FRONTEND_DIST_INDEX = path.join(FRONTEND_DIR, 'dist', 'index.html')
const FRONTEND_URL = 'http://127.0.0.1:5173'
const DEV_BACKEND_PORT = 8000
const PACKAGED_BACKEND_PORT = 43123
const FRONTEND_PORT = 5173
const LIBRARY_STORE_PATH = path.join(app.getPath('userData'), 'library.json')

let backendProcess = null
let frontendProcess = null
let windowRef = null
let backendPort = app.isPackaged ? PACKAGED_BACKEND_PORT : DEV_BACKEND_PORT

function createWindow() {
  process.env.THAI_COMIC_READER_API_BASE_URL = `http://127.0.0.1:${backendPort}`
  process.env.THAI_COMIC_READER_APP_VERSION = app.getVersion()
  windowRef = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    title: 'Thai Comic Reader',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const hasBundledFrontend = fs.existsSync(FRONTEND_DIST_INDEX)
  if (hasBundledFrontend) {
    windowRef.loadFile(FRONTEND_DIST_INDEX)
  } else {
    windowRef.loadURL(FRONTEND_URL)
  }
  windowRef.on('closed', () => {
    windowRef = null
  })
}

function waitForPort(port, timeoutMs = 20000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.end()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}.`))
          return
        }
        setTimeout(attempt, 500)
      })
    }
    attempt()
  })
}

function findAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', (error) => {
      if (error?.code !== 'EADDRINUSE') {
        reject(error)
        return
      }

      const fallbackServer = net.createServer()
      fallbackServer.unref()
      fallbackServer.once('error', reject)
      fallbackServer.listen(0, '127.0.0.1', () => {
        const address = fallbackServer.address()
        const port = typeof address === 'object' && address ? address.port : 0
        fallbackServer.close(() => resolve(port))
      })
    })
    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : preferredPort
      server.close(() => resolve(port))
    })
  })
}

function startBackend() {
  if (backendProcess) {
    return
  }

  const pythonBin = resolvePythonCommand()
  if (!pythonBin.command) {
    throw new Error('No usable Python runtime was found for the backend.')
  }

  fs.mkdirSync(RUN_DIR, { recursive: true })
  const backendLog = fs.openSync(path.join(RUN_DIR, 'backend.log'), 'a')
  backendProcess = spawn(
    pythonBin.command,
    [...pythonBin.args, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(backendPort)],
    {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        THAI_COMIC_READER_DATA_DIR: app.getPath('userData'),
      },
      stdio: ['ignore', backendLog, backendLog],
    },
  )

  backendProcess.once('exit', () => {
    backendProcess = null
  })
}

function startFrontend() {
  if (frontendProcess) {
    return
  }

  if (fs.existsSync(FRONTEND_DIST_INDEX)) {
    return
  }

  if (!fs.existsSync(path.join(FRONTEND_DIR, 'node_modules'))) {
    throw new Error('Frontend dependencies are missing in frontend/node_modules.')
  }

  fs.mkdirSync(RUN_DIR, { recursive: true })
  const frontendLog = fs.openSync(path.join(RUN_DIR, 'frontend.log'), 'a')
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  frontendProcess = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(FRONTEND_PORT)],
    {
      cwd: FRONTEND_DIR,
      stdio: ['ignore', frontendLog, frontendLog],
    },
  )

  frontendProcess.once('exit', () => {
    frontendProcess = null
  })
}

function resolvePythonCommand() {
  const candidates = process.platform === 'win32'
    ? [
        path.join(BUNDLED_BACKEND_RUNTIME_DIR, '.venv', 'Scripts', 'python.exe'),
        path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe'),
        path.join(BUNDLED_BACKEND_RUNTIME_DIR, '.venv', 'bin', 'python'),
        path.join(BACKEND_DIR, '.venv', 'bin', 'python'),
      ]
    : [
        path.join(BUNDLED_BACKEND_RUNTIME_DIR, '.venv', 'bin', 'python'),
        path.join(BACKEND_DIR, '.venv', 'bin', 'python'),
        path.join(BUNDLED_BACKEND_RUNTIME_DIR, '.venv', 'Scripts', 'python.exe'),
        path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe'),
      ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { command: candidate, args: [] }
    }
  }

  return process.platform === 'win32'
    ? { command: 'py', args: ['-3'] }
    : { command: 'python3', args: [] }
}

async function bootstrap() {
  if (app.isPackaged) {
    backendPort = await findAvailablePort(PACKAGED_BACKEND_PORT)
  }

  if (!fs.existsSync(FRONTEND_DIST_INDEX)) {
    try {
      await waitForPort(FRONTEND_PORT, 1500)
    } catch {
      startFrontend()
      await waitForPort(FRONTEND_PORT)
    }
  }

  if (app.isPackaged) {
    startBackend()
  } else {
    try {
      await waitForPort(backendPort, 1500)
    } catch {
      startBackend()
    }
  }

  await waitForPort(backendPort)
  createWindow()
}

app.whenReady().then(async () => {
  try {
    await bootstrap()
  } catch (error) {
    dialog.showErrorBox(
      'Thai Comic Reader failed to start',
      [
        'The Electron shell could not connect to the existing app services.',
        '',
        `Frontend bundle expected at: ${FRONTEND_DIST_INDEX}`,
        `Dev frontend fallback: ${FRONTEND_URL}`,
        `Backend source expected at: ${BACKEND_DIR}`,
        `Bundled backend runtime expected at: ${BUNDLED_BACKEND_RUNTIME_DIR}`,
        `Backend expected on port: ${backendPort}`,
        '',
        'Either build the frontend first or make sure the regular app dependencies are installed.',
        '',
        `Electron logs: ${RUN_DIR}`,
        '',
        String(error.message || error),
      ].join('\n'),
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
  if (frontendProcess) {
    frontendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (!windowRef) {
    createWindow()
  }
})

ipcMain.handle('shell:openExternal', async (_event, url) => {
  await shell.openExternal(url)
})

ipcMain.handle('dialog:selectDocument', async (_event, type) => {
  const filters = type === 'pdf'
    ? [{ name: 'PDF Files', extensions: ['pdf'] }]
    : [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]

  const result = await dialog.showOpenDialog(windowRef || undefined, {
    title: type === 'pdf' ? 'Open PDF' : 'Open Image',
    properties: ['openFile'],
    filters,
  })

  if (result.canceled || !result.filePaths.length) {
    return null
  }

  const selectedPath = result.filePaths[0]
  return {
    path: selectedPath,
    name: path.basename(selectedPath),
    type,
  }
})

ipcMain.handle('storage:readLibrary', async () => {
  try {
    if (!fs.existsSync(LIBRARY_STORE_PATH)) {
      return []
    }

    const raw = fs.readFileSync(LIBRARY_STORE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

ipcMain.handle('storage:writeLibrary', async (_event, items) => {
  try {
    fs.mkdirSync(path.dirname(LIBRARY_STORE_PATH), { recursive: true })
    fs.writeFileSync(LIBRARY_STORE_PATH, JSON.stringify(Array.isArray(items) ? items : [], null, 2), 'utf-8')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error.message || error) }
  }
})
