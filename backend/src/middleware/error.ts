/* eslint-disable @typescript-eslint/no-unused-vars */
import { Response, Request, NextFunction } from "express";
import { HttpException } from "@util/http-exception";
import { ResponseParser } from "@util/response-parser";
import i18n from "i18n";

function errorMiddleware(
  error: HttpException,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const httpCode = error.status || 500;
  const message = error.message || i18n.__("ERR10001");
  const code = error.code || "ERR10001";
  const responseParser = new ResponseParser();
  responseParser
    .setHttpCode(httpCode)
    .setStatus(false)
    .setMessage(message)
    .setResponseCode(code)
    .send(response);
}

export default errorMiddleware;
