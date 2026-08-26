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
  download(@Param("token") token: string, @Res() res: Response) {
    const { buf, mime } = this.storage.readObject(token);
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(buf);
  }
}
