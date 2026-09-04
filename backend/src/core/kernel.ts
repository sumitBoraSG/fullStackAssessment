import * as bodyParser from "body-parser";
import { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import i18n from "i18n";
import swaggerUi from "swagger-ui-express";
import * as Sentry from "@sentry/node";
import { RequestIDMiddleware } from "@middleware/request-id";
import { DBConnection } from "@database/db-connection";
import errorMiddleware from "@middleware/error";
import { SENTRY_DSN, FRONTEND_URL, ENVIRONMENT } from "@config/secret";
import constant from "@config/constant";
import { openApiSpec } from "@docs/index";
import path from "path";

export class Kernel {
  private requestId: RequestIDMiddleware = new RequestIDMiddleware();

  public initBodyParser(app: Application): void {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
  }

  public initSecurityHeaders(app: Application): void {
    // Pure JSON API behind a separate frontend origin — no server-rendered
    // HTML, so Helmet's defaults apply cleanly without loosening CSP for
    // inline scripts/styles.
    app.use(helmet());
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

  public initSwagger(app: Application): void {
    if (ENVIRONMENT === constant.PRODUCTION) {
      return;
    }

    // Path-scoped CSP removal: the global helmet() call in
    // initSecurityHeaders already sets a Content-Security-Policy header
    // (default: no 'unsafe-inline' for script-src) on every response before
    // this middleware runs. Swagger UI's HTML serves an inline <script> to
    // bootstrap itself, which that CSP would block. A second, path-scoped
    // helmet({ contentSecurityPolicy: false }) call would NOT fix this — it
    // only omits setting a new CSP, it doesn't clear the header already set
    // upstream — so the header must be explicitly removed here, only for
    // requests under /api-docs, leaving every other route untouched.
    app.use("/api-docs", (_req: Request, res: Response, next: NextFunction): void => {
      res.removeHeader("Content-Security-Policy");
      next();
    });

    app.get("/api-docs.json", (_req: Request, res: Response): void => {
      res.json(openApiSpec);
    });

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
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
