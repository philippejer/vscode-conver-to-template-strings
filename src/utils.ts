
export function logDebug(...objects: any[]) {
  console.log(...objects);
}

export function logInfo(...objects: any[]) {
  console.info(...objects);
}

export function logWarn(...objects: any[]) {
  console.warn(...objects);
}

export function logError(...objects: any[]) {
  console.error(...objects);
}

export function assert(condition: boolean, ...objects: any[]) {
  if (!condition) {
    logError(...objects);
    throw new Error('Failed assertion');
  }
}

export function abort(...objects: any[]) {
  logError(...objects);
  throw new Error('Abort');
}