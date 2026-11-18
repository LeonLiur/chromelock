// Simple logger utility
const logger = {
  log: (...args) => {
    console.log('[ChromeLock]', ...args);
  },
  error: (...args) => {
    console.error('[ChromeLock ERROR]', ...args);
  },
  warn: (...args) => {
    console.warn('[ChromeLock WARN]', ...args);
  }
};
