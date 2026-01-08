/**
 * Simple structured logger for backend services
 */
export function createServiceLogger(serviceName: string) {
  return {
    info: (message: string, meta?: any) => {
      console.log(`[${new Date().toISOString()}] [${serviceName}] INFO: ${message}`, meta || '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[${new Date().toISOString()}] [${serviceName}] WARN: ${message}`, meta || '');
    },
    error: (message: string, meta?: any) => {
      console.error(`[${new Date().toISOString()}] [${serviceName}] ERROR: ${message}`, meta || '');
    },
    debug: (message: string, meta?: any) => {
      if (process.env.DEBUG) {
        console.debug(`[${new Date().toISOString()}] [${serviceName}] DEBUG: ${message}`, meta || '');
      }
    }
  };
}
