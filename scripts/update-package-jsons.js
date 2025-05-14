const fs = require('fs')
const path = require('path')
const glob = require('glob')

const TARGET_CONFIG = {
  publishConfig: {
    registry: "https://streamliners-npm-368438108069.d.codeartifact.ap-southeast-2.amazonaws.com/npm/tina-cms-snz/"
  },
  repository: {
    url: "https://github.com/StreamlinersNZ/tinacms.git"
  }
}

function updatePackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const packageJson = JSON.parse(content)
    
    // Update or add publishConfig
    packageJson.publishConfig = TARGET_CONFIG.publishConfig
    
    // Update repository URL
    if (packageJson.repository) {
      // Keep the directory if it exists, otherwise use the package name
      const directory = packageJson.repository.directory || `packages/${packageJson.name}`
      packageJson.repository = {
        ...TARGET_CONFIG.repository,
        directory
      }
    } else {
      packageJson.repository = TARGET_CONFIG.repository
    }
    
    // Write back to file with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n')
    console.log(`✅ Updated ${filePath}`)
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error)
  }
}

// Find all package.json files in the @tinacms packages
const packageJsonFiles = glob.sync('packages/@tinacms/*/package.json', {
  ignore: ['**/node_modules/**', '**/dist/**']
})

console.log(`Found ${packageJsonFiles.length} package.json files in @tinacms packages`)

// Process each package.json file
packageJsonFiles.forEach(file => {
  updatePackageJson(file)
})

console.log('Done!') 