import 'expo-sqlite/localStorage/install'

// On phones, expo-sqlite provides a synchronous localStorage that survives
// app restarts. (localStore.web.ts uses the browser's own.)
export const store: Storage = globalThis.localStorage
