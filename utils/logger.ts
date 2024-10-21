// utils/logger.ts
import { logger, fileAsyncTransport } from 'react-native-logs';
import RNFS from 'react-native-fs';

const today = new Date();
const date = today.getDate().toString().padStart(2, '0');
const month = (today.getMonth() + 1).toString().padStart(2, '0');
const year = today.getFullYear();
const hours = today.getHours().toString().padStart(2, '0');
const minutes = today.getMinutes().toString().padStart(2, '0');
const seconds = today.getSeconds().toString().padStart(2, '0');

// Add timestamp to the filenames
const timestamp = `${year}-${month}-${date}_${hours}-${minutes}-${seconds}`;
const logFileName = `logs_${timestamp}.txt`;
const errorLogFileName = `errors_${timestamp}.txt`;

// Ensure directory exists before writing to it
const ensureDirectoryExists = async (directory: string) => {
  const dirInfo = await RNFS.stat(directory).catch(() => null);
  if (!dirInfo) {
    await RNFS.mkdir(directory);
  }
};

// Prepare log directory
const logDirectory = `${RNFS.DocumentDirectoryPath}/logs/`;
ensureDirectoryExists(logDirectory).catch(error => {
  console.error('Error ensuring log directory exists:', error);
});

// Logger configuration
const logConfig = {
  severity: 'debug',
  transport: fileAsyncTransport,
  transportOptions: {
    FS: RNFS,
    fileName: logFileName,
    filePath: logDirectory, // Ensure the file is created in the correct directory
  },
};

// Error Logger configuration
const errorLogConfig = {
  severity: 'debug',
  transport: fileAsyncTransport,
  transportOptions: {
    FS: RNFS,
    fileName: errorLogFileName,
    filePath: logDirectory, // Ensure the file is created in the correct directory
  },
};

const log = logger.createLogger(logConfig);
const errorLog = logger.createLogger(errorLogConfig);

export const logMessage = (message: string) => {
  log.info(message);
  console.log(message); // Log to console for immediate debugging
};

export const logError = (message: string, error: any) => {
  const errorMessage = `${message} - ${error instanceof Error ? error.stack : JSON.stringify(error)}`;
  errorLog.error(errorMessage);
  console.error(errorMessage); // Log to console for immediate debugging
};

export const setLoggingEnabled = (enabled: boolean) => {
  log.setSeverity(enabled ? 'debug' : 'silent');
  errorLog.setSeverity(enabled ? 'debug' : 'silent');
};

export const isLoggingEnabled = () => log.getSeverity() !== 'silent' && errorLog.getSeverity() !== 'silent';

export const getLogFilePath = () => ({
  logFilePath: `${logDirectory}${logFileName}`,
  errorLogFilePath: `${logDirectory}${errorLogFileName}`,
});
