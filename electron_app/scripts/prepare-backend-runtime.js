const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..', '..')
const BACKEND_DIR = path.join(ROOT_DIR, 'backend')
const BACKEND_MACOS_DIR = path.join(ROOT_DIR, 'backend_macos')
const BACKEND_WINDOWS_DIR = path.join(ROOT_DIR, 'backend_windows')
const STAGE_ROOT = path.join(ROOT_DIR, 'electron_app', 'bundle')
const STAGE_DIR = path.join(STAGE_ROOT, 'backend-runtime')

const BACKEND_EXCLUDES = new Set([
  '.venv',
  '__pycache__',
  'storage',
  '.DS_Store',
  'page13-crop.png',
  'test-blank.png',
  'test-thai.png',
])

const VENV_TOP_LEVEL_PRUNE = [
  'include',
  'share',
]

const VENV_SITE_PACKAGES_PRUNE_PREFIXES = [
  'pip',
  'setuptools',
]

const REQUIRED_PYTHON_PACKAGES = [
  'numpy',
  'PIL',
  'uvicorn',
]

function main() {
  const targetPlatform = resolveTargetPlatform()
  const runtimeSource = resolveRuntimeSource(targetPlatform)

  console.log('Preparing backend runtime bundle...')
  console.log(`Target platform: ${targetPlatform}`)
  console.log(`Runtime source: ${runtimeSource}`)

  cleanupOldStageDirs()
  if (fs.existsSync(STAGE_DIR)) {
    fs.renameSync(STAGE_DIR, `${STAGE_DIR}.old.${Date.now()}`)
  }
  fs.mkdirSync(STAGE_DIR, { recursive: true })

  copyBackendSource()
  copyBundledVenv(runtimeSource)
  copyFileIfPresent(path.join(ROOT_DIR, 'dictionary.js'), path.join(STAGE_DIR, 'dictionary.js'))
  copyFileIfPresent(path.join(ROOT_DIR, 'telex-utf8.csv'), path.join(STAGE_DIR, 'telex-utf8.csv'))

  console.log('Backend runtime staged at:')
  console.log(`  ${STAGE_DIR}`)
}

function resolveTargetPlatform() {
  const requested = (process.env.THAI_COMIC_READER_TARGET || process.argv[2] || process.platform).toLowerCase()
  if (requested === 'darwin' || requested === 'mac' || requested === 'macos') {
    return 'mac'
  }
  if (requested === 'win32' || requested === 'win' || requested === 'windows') {
    return 'windows'
  }
  throw new Error(`Unsupported target platform "${requested}". Use "mac" or "windows".`)
}

function resolveRuntimeSource(targetPlatform) {
  const candidates = targetPlatform === 'mac'
    ? [
        path.join(BACKEND_MACOS_DIR, '.venv'),
        path.join(BACKEND_DIR, '.venv'),
      ]
    : [
        path.join(BACKEND_WINDOWS_DIR, '.venv'),
      ]

  for (const candidate of candidates) {
    if (isUsableRuntime(candidate)) {
      return candidate
    }
  }

  if (targetPlatform === 'windows') {
    throw new Error(
      `No Windows backend runtime found. Expected ${path.join(BACKEND_WINDOWS_DIR, '.venv')}.\n` +
      'Build the Windows Python environment on Windows first, then rerun package prep.',
    )
  }

  throw new Error(
    `No macOS backend runtime found. Expected ${path.join(BACKEND_MACOS_DIR, '.venv')} or ${path.join(BACKEND_DIR, '.venv')}.`,
  )
}

function isUsableRuntime(venvPath) {
  if (!fs.existsSync(venvPath)) {
    return false
  }

  const sitePackagesPath = resolveSitePackagesPath(venvPath)
  if (!sitePackagesPath || !fs.existsSync(sitePackagesPath)) {
    return false
  }

  return REQUIRED_PYTHON_PACKAGES.every((packageName) => fs.existsSync(path.join(sitePackagesPath, packageName)))
}

function resolveSitePackagesPath(venvPath) {
  const windowsSitePackagesPath = path.join(venvPath, 'Lib', 'site-packages')
  if (fs.existsSync(windowsSitePackagesPath)) {
    return windowsSitePackagesPath
  }

  const libPath = path.join(venvPath, 'lib')
  if (!fs.existsSync(libPath)) {
    return null
  }

  for (const entry of fs.readdirSync(libPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('python')) {
      continue
    }

    const sitePackagesPath = path.join(libPath, entry.name, 'site-packages')
    if (fs.existsSync(sitePackagesPath)) {
      return sitePackagesPath
    }
  }

  return null
}

function cleanupOldStageDirs() {
  for (const entry of fs.readdirSync(STAGE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    if (!entry.name.startsWith('backend-runtime.old.')) {
      continue
    }
    try {
      removeDirectory(path.join(STAGE_ROOT, entry.name))
    } catch (error) {
      console.warn(`Skipping cleanup for ${entry.name}: ${error.message}`)
    }
  }
}

function copyBackendSource() {
  const targetDir = path.join(STAGE_DIR, 'backend')
  fs.mkdirSync(targetDir, { recursive: true })
  copyDirectory(BACKEND_DIR, targetDir, {
    shouldSkip(relativePath, entry) {
      const firstSegment = relativePath.split(path.sep)[0]
      if (BACKEND_EXCLUDES.has(firstSegment)) {
        return true
      }
      return entry.name === '.DS_Store'
    },
  })
}

function copyBundledVenv(sourceDir) {
  const targetDir = path.join(STAGE_DIR, '.venv')
  copyDirectory(sourceDir, targetDir, {
    shouldSkip(relativePath, entry) {
      const segments = relativePath.split(path.sep)
      const name = entry.name

      if (segments.length === 1 && VENV_TOP_LEVEL_PRUNE.includes(name)) {
        return true
      }

      if (name === '__pycache__' || name === '.pytest_cache' || name === 'tests' || name === 'test') {
        return true
      }

      if (!entry.isDirectory() && (name.endsWith('.pyc') || name.endsWith('.pyo') || name.endsWith('.a'))) {
        return true
      }

      const sitePackagesIndex = segments.indexOf('site-packages')
      if (sitePackagesIndex >= 0) {
        const sitePackagesChild = segments[sitePackagesIndex + 1]
        if (
          sitePackagesChild &&
          VENV_SITE_PACKAGES_PRUNE_PREFIXES.some((prefix) => sitePackagesChild === prefix || sitePackagesChild.startsWith(`${prefix}-`))
        ) {
          return true
        }
      }

      return false
    },
  })
}

function copyDirectory(sourceDir, targetDir, options) {
  fs.mkdirSync(targetDir, { recursive: true })

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    const relativePath = path.relative(sourceDir, sourcePath)

    if (options?.shouldSkip?.(relativePath, entry)) {
      continue
    }

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, options)
      continue
    }

    if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath)
      fs.symlinkSync(linkTarget, targetPath)
      continue
    }

    fs.copyFileSync(sourcePath, targetPath)
  }
}

function copyFileIfPresent(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return
  }
  fs.copyFileSync(sourcePath, targetPath)
}

function removeDirectory(targetPath) {
  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
}

main()
