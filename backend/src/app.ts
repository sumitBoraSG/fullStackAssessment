import express from "express";
import "express-async-errors";
import "module-alias/register";
import { Routes } from "@api/route";
import { unhandledExceptionHandler } from "@util/unhandled-exception";
import { Kernel } from "./core/kernel";

class App {
  public app: express.Application = express();
  public ready: Promise<void>;
  private kernel: Kernel = new Kernel();
  private router: Routes = new Routes();
  constructor() {
    // Trust exactly one reverse-proxy hop (the deployment's own load
    // balancer/proxy), not an arbitrary X-Forwarded-For chain. Needed for
    // express-rate-limit's req.ip and secure-cookie detection to be correct
    // when the app sits behind a proxy.
    this.app.set("trust proxy", 1);
    this.ready = this.initMiddlewares();
  }

  private async initMiddlewares(): Promise<void> {
    this.kernel.initSentry(this.app);
    this.kernel.initSecurityHeaders(this.app);
    this.kernel.initBodyParser(this.app);
    this.kernel.addCommonMiddleware(this.app);
    this.kernel.initCookieParser(this.app);
    this.kernel.initSwagger(this.app);
    await this.kernel.databaseConnection();
    this.kernel.initTranslation(this.app);
    this.router.routes(this.app);
    this.kernel.sentryErrorHandler(this.app);
    this.kernel.errorMiddleware(this.app);
    unhandledExceptionHandler();
  }
}

const appInstance = new App();
// Exposed so integration tests can await full startup (DB connection +
// routes mounted) before issuing requests — server.ts is unaffected.
appInstance.app.locals.ready = appInstance.ready;

export default appInstance.app;
