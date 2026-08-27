import winston, { format } from "winston";

const { combine, timestamp, colorize, printf } = format;

const errorStackTracerFormat = winston.format((info) => {
  if (info instanceof Error) {
    // DO NOT DELETE THIS
    // tslint:disable-next-line: no-console
    // eslint-disable-next-line no-console
    console.error(info);
  }
  return info;
});

const options: winston.LoggerOptions = {
  format: combine(
    timestamp(),
    errorStackTracerFormat(),
    colorize({
      all: true,
      colors: { info: "green", warn: "orange", error: "red" },
    }),
    printf(
  (info) =>
    `${info.timestamp}|-|${info.level}|-|${info.message} ${
      info.data ? JSON.stringify(info.data) : ""
    }`,
)
  ),
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === "production" ? "error" : "debug",
    }),
    new winston.transports.File({ filename: "debug.log", level: "debug" }),
  ],
};

const logger = winston.createLogger(options);

if (process.env.NODE_ENV !== "production") {
  logger.debug("Logging initialized at debug level");
}

export default logger;
