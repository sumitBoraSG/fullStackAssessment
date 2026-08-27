import express from "express";
import "express-async-errors";
import "module-alias/register";
import { Routes } from "@api/route";
import { unhandledExceptionHandler } from "@util/unhandled-exception";
import { Kernel } from "./core/kernel";

class App {
  public app: express.Application = express();
  private kernel: Kernel = new Kernel();
  private router: Routes = new Routes();
  constructor() {
    this.initMiddlewares();
  }

  private async initMiddlewares(): Promise<void> {
    this.kernel.initSentry(this.app);
    this.kernel.initBodyParser(this.app);
    this.kernel.addCommonMiddleware(this.app);
    this.kernel.initCookieParser(this.app);
    await this.kernel.databaseConnection();
    this.kernel.initTranslation(this.app);
    this.router.routes(this.app);
    this.kernel.sentryErrorHandler(this.app);
    this.kernel.errorMiddleware(this.app);
    unhandledExceptionHandler();
  }
}

export default new App().app;
