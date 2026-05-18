import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logDir = 'logs';

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const errorFileRotate = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

const combinedFileRotate = new DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

const httpFileRotate = new DailyRotateFile({
  filename: path.join(logDir, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: prodFormat,
  transports: [errorFileRotate, combinedFileRotate, httpFileRotate],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: devFormat }));
}

(logger as any).stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
