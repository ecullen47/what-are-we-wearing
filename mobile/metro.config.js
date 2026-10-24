const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// The web app's plain-TypeScript helpers (palette, dates, event types) live
// in ../lib and are shared rather than copied. That folder sits outside this
// project and isn't a workspace, so Metro has to be told to watch it.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../lib')]

module.exports = config
