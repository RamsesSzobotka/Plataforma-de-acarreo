let debugMode = false
let originalLog: typeof console.log = () => {}
let originalDebug: typeof console.debug = () => {}

export function initDebugMode(enabled: boolean) {
  originalLog = console.log.bind(console)
  originalDebug = console.debug.bind(console)
  setDebugMode(enabled)
}

export function setDebugMode(enabled: boolean) {
  debugMode = enabled
  if (enabled) {
    console.log = originalLog
    // @ts-ignore
    console.debug = originalDebug
  } else {
    console.log = () => {}
    // @ts-ignore
    console.debug = () => {}
  }
}

export function getDebugMode(): boolean {
  return debugMode
}
