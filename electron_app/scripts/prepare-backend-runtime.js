const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..', '..')
const BACKEND_DIR = path.join(ROOT_DIR, 'backend')
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

function main() {
  console.log('Preparing backend runtime bundle...')

  cleanupOldStageDirs()
  if (fs.existsSync(STAGE_DIR)) {
    fs.renameSync(STAGE_DIR, `${STAGE_DIR}.old.${Date.now()}`)
  }
  fs.mkdirSync(STAGE_DIR, { recursive: true })

  copyBackendSource()
  copyBundledVenv()
  copyFileIfPresent(path.join(ROOT_DIR, 'dictionary.js'), path.join(STAGE_DIR, 'dictionary.js'))
  copyFileIfPresent(path.join(ROOT_DIR, 'telex-utf8.csv'), path.join(STAGE_DIR, 'telex-utf8.csv'))

  console.log('Backend runtime staged at:')
  console.log(`  ${STAGE_DIR}`)
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

function copyBundledVenv() {
  const sourceDir = path.join(BACKEND_DIR, '.venv')
  if (!fs.existsSync(sourceDir)) {
    return
  }

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
