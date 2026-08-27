// Copyright (C) 2019 by StudioGraphene. All rights reserved.

import { Response } from "express";

export class ResponseParser {
  /**
   * Method to set and send response back
   *
   * @param res
   */

  public static parseAndSend(
    httpCode: number,
    status: boolean,
    message: string,
    code: string,
    data: Record<string, unknown>,
    res: Response,
  ): void {
    res.status(httpCode).json({
      status,
      message,
      code,
      data,
    });
  }
  private resHttpCode: number;
  private resStatus: boolean;
  private resMessage: string;
  private resCode: string;
  private resBody: unknown;

  constructor() {
    this.resHttpCode = 200;
    this.resStatus = true;
    this.resMessage = "";
    this.resCode = "SUC10000";
    this.resBody = {};
  }

  /**
   * Setter for httpCode for response
   *
   * @param httpCode
   */

  public setHttpCode(httpCode: number): this {
    this.resHttpCode = httpCode;
    return this;
  }

  /**
   * Setter for status for response
   *
   * @param status
   */

  public setStatus(status: boolean): this {
    this.resStatus = status;
    return this;
  }

  /**
   * Setter for message of response
   *
   * @param message
   */

  public setMessage(message: string): this {
    this.resMessage = message;
    return this;
  }

  /**
   * Setter for code of response
   *
   * @param message
   */

  public setResponseCode(code: string): this {
    this.resCode = code;
    return this;
  }

  /**
   * Setter for body of response
   *
   * @param body
   */

  public setBody<T>(body: T): this {
    this.resBody = body;
    return this;
  }

  /**
   * Method to send response back
   *
   * @param res
   */

  public send(res: Response): void {
    res.status(this.resHttpCode).json({
      status: this.resStatus,
      message: this.resMessage,
      code: this.resCode,
      data: this.resBody,
    });
  }
}
