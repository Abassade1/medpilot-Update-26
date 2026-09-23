import { Controller, Get, Param, Put, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../../common/auth.guard";
import { StorageService, BUCKETS } from "./storage.service";
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
    const { buf, mime, bucket } = await this.storage.readObject(token);
    res.setHeader("Content-Type", mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (bucket === BUCKETS.public) {
      // Provider logos, cover photos and listing images: meant to be shown inline to any
      // member browsing the catalog, and safe to cache — the opposite of a PHI download.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Disposition", "inline");
      // Helmet's default Cross-Origin-Resource-Policy: same-origin blocks an <img> on the
      // institutional provider web portal (a separate origin) from embedding this file at all —
      // the browser drops it with ERR_BLOCKED_BY_RESPONSE before it ever reaches the page.
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    } else {
      // Sensitive content: never store in a shared cache, and do not let the
      // filename or type be reinterpreted by the browser.
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", "attachment");
    }
    res.send(buf);
  }
}
