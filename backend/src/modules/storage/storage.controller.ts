import { Controller, Get, Param, Put, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../../common/auth.guard";
import { StorageService } from "./storage.service";
import { AppError } from "../../common/errors";

/**
 * Signed transfer endpoints (local driver). Authentication is the HMAC in the
 * URL itself — exactly like an S3 presigned URL — so these are @Public but
 * unusable without a ticket minted for the caller.
 */
@Controller("v1")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Put("uploads/:token")
  async upload(@Param("token") token: string, @Req() req: Request) {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new AppError("bad_request", "Missing file body");
    }
    return this.storage.receiveUpload(token, body);
  }

  @Public()
  @Get("files/:token")
  async download(@Param("token") token: string, @Res() res: Response) {
    const { buf, mime } = await this.storage.readObject(token);
    res.setHeader("Content-Type", mime);
    // Sensitive content: never store in a shared cache, and do not let the
    // filename or type be reinterpreted by the browser.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "attachment");
    res.send(buf);
  }
}
