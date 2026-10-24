// The web preview uses the browser's localStorage; expo-sqlite's web build
// needs extra WebAssembly bundling that isn't worth it here.
export const store: Storage = globalThis.localStorage
