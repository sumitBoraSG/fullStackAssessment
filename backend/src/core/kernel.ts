import * as bodyParser from "body-parser";
import { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import i18n from "i18n";
import * as Sentry from "@sentry/node";
import { RequestIDMiddleware } from "@middleware/request-id";
import { DBConnection } from "@database/db-connection";
import errorMiddleware from "@middleware/error";
import { SENTRY_DSN, FRONTEND_URL } from "@config/secret";
import constant from "@config/constant";
import path from "path";

export class Kernel {
  private requestId: RequestIDMiddleware = new RequestIDMiddleware();

  public initBodyParser(app: Application): void {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
  }

  public addRequestId(app: Application): void {
    app.use(this.requestId.assign);
  }

  public errorMiddleware(app: Application): void {
    app.use(errorMiddleware);
  }

  public databaseConnection(): Promise<void> {
    return DBConnection.databaseConnection();
  }

  public initTranslation(app: Application): void {
    i18n.configure({
      locales: [constant.ENGLISH_LOCALE, constant.SPANISH_LOCALE],
      defaultLocale: constant.ENGLISH_LOCALE,
      queryParameter: "lang",
      directory: path.join(__dirname, "..", "..", "locales"),
    });
    app.use(i18n.init);
  }

  public initCookieParser(app: Application): void {
    app.use(cookieParser());
  }

  public addCommonMiddleware(app: Application): void {
    app.use(this.requestId.assign);
    const corsOptions = {
      origin: FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
      optionsSuccessStatus: 200,
    };
    app.use(cors(corsOptions));
  }

  public initSentry(app: Application): void {
    Sentry.init({ dsn: SENTRY_DSN });
    app.use(Sentry.Handlers.requestHandler());
  }

  public sentryErrorHandler(app: Application): void {
    if (SENTRY_DSN) {
      app.use(Sentry.Handlers.errorHandler());
    }
  }
}
