import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Roles } from "../../common/auth.guard";
import { validate } from "../../common/validate";
import { apiRoute } from "../../docs/registry";
import { IdempotencyService } from "../bookings/idempotency";
import { VendorsService } from "./vendors.service";
import { taxonomyForClient } from "./taxonomy";
import {
  AvailabilityBody, BookListingBody, BookingsQuery, CreateListingBody, CreateProviderBody, DecisionBody, DiscoverQuery,
  ImageUploadUrlBody, ListingsQuery, PatchListingBody, PatchProviderBody, SlotsQuery, VerificationBody,
} from "./vendors.schemas";

const Uuid = z.string().uuid();
const BookingAction = z.enum(["confirm", "decline", "complete", "cancel"]);

/** The provider portal. Every route resolves the caller's own provider account first, so a provider can only ever reach their own records. */
@Controller("v1/provider")
export class ProviderController {
  constructor(private readonly vendors: VendorsService) {}

  @Get("taxonomy") taxonomy() { return taxonomyForClient(); }
  @Get("me") me(@Req() req: Request) { return this.vendors.getMine(req.userId!); }
  @Post() create(@Req() req: Request, @Body() body: unknown) { return this.vendors.createProvider(req.userId!, validate(CreateProviderBody, body)); }
  @Patch() patch(@Req() req: Request, @Body() body: unknown) { return this.vendors.patchProvider(req.userId!, validate(PatchProviderBody, body)); }
  @HttpCode(200) @Post("verification")
  verification(@Req() req: Request, @Body() body: unknown) { return this.vendors.submitVerification(req.userId!, validate(VerificationBody, body).licenseInfo); }
  @Get("dashboard") dashboard(@Req() req: Request) { return this.vendors.dashboard(req.userId!); }

  @Post("images/upload-url") imageUploadUrl(@Req() req: Request, @Body() body: unknown) {
    return this.vendors.imageUploadUrl(req.userId!, validate(ImageUploadUrlBody, body));
  }
  @HttpCode(200) @Post("images/:fileId/confirm")
  confirmImage(@Req() req: Request, @Param("fileId") fileId: string) { return this.vendors.confirmImage(req.userId!, validate(Uuid, fileId)); }

  @Get("listings") list(@Req() req: Request, @Query() q: unknown) { return this.vendors.listMine(req.userId!, validate(ListingsQuery, q)); }
  @Post("listings") createListing(@Req() req: Request, @Body() body: unknown) { return this.vendors.createListing(req.userId!, validate(CreateListingBody, body)); }
  @Get("listings/:id") getListing(@Req() req: Request, @Param("id") id: string) { return this.vendors.getMineListing(req.userId!, validate(Uuid, id)); }
  @Patch("listings/:id") patchListing(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    return this.vendors.patchListing(req.userId!, validate(Uuid, id), validate(PatchListingBody, body));
  }
  @HttpCode(200) @Post("listings/:id/publish") publish(@Req() req: Request, @Param("id") id: string) { return this.vendors.publish(req.userId!, validate(Uuid, id)); }
  @HttpCode(200) @Post("listings/:id/unpublish") unpublish(@Req() req: Request, @Param("id") id: string) { return this.vendors.unpublish(req.userId!, validate(Uuid, id)); }
  @HttpCode(200) @Post("listings/:id/archive") archive(@Req() req: Request, @Param("id") id: string) { return this.vendors.archive(req.userId!, validate(Uuid, id)); }
  @Post("listings/:id/duplicate") duplicate(@Req() req: Request, @Param("id") id: string) { return this.vendors.duplicate(req.userId!, validate(Uuid, id)); }
  @HttpCode(204) @Delete("listings/:id") remove(@Req() req: Request, @Param("id") id: string) { return this.vendors.deleteListing(req.userId!, validate(Uuid, id)); }
  @Get("listings/:id/availability") availability(@Req() req: Request, @Param("id") id: string) { return this.vendors.getAvailability(req.userId!, validate(Uuid, id)); }
  @Put("listings/:id/availability") putAvailability(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    return this.vendors.putAvailability(req.userId!, validate(Uuid, id), validate(AvailabilityBody, body));
  }

  @Get("bookings") bookings(@Req() req: Request, @Query() q: unknown) { return this.vendors.listBookings(req.userId!, validate(BookingsQuery, q).status); }
  @Get("bookings/:id") booking(@Req() req: Request, @Param("id") id: string) { return this.vendors.getBooking(req.userId!, validate(Uuid, id)); }
  @HttpCode(200) @Post("bookings/:id/:action")
  act(@Req() req: Request, @Param("id") id: string, @Param("action") action: string, @Body() body: unknown) {
    return this.vendors.actOnBooking(req.userId!, validate(Uuid, id), validate(BookingAction, action), validate(DecisionBody, body ?? {}).reason);
  }
}

/** What members see: only published listings. */
@Controller("v1/listings")
export class ListingsController {
  constructor(private readonly vendors: VendorsService, private readonly idem: IdempotencyService) {}

  @Get() discover(@Query() q: unknown) { return this.vendors.discover(validate(DiscoverQuery, q)); }
  @Get("facets") facets() { return this.vendors.facets(); }
  @Get(":id") detail(@Req() req: Request, @Param("id") id: string, @Query("preview") preview?: string) {
    return this.vendors.detail(validate(Uuid, id), req.userId!, preview === "true");
  }
  @Get(":id/slots") slots(@Param("id") id: string, @Query() q: unknown) { return this.vendors.slots(validate(Uuid, id), validate(SlotsQuery, q).date); }
  @Post(":id/bookings")
  async book(@Req() req: Request, @Param("id") id: string, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const listingId = validate(Uuid, id);
    const input = validate(BookListingBody, body);
    const { body: out } = await this.idem.run(req.userId!, `listing-bookings:${listingId}`, key, () => this.vendors.book(req.userId!, listingId, input));
    return out;
  }
}

/** Operations decisions on providers and listings. */
@Controller("v1/staff")
export class StaffVendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Roles("staff", "admin") @HttpCode(200) @Post("providers/:id/:decision")
  provider(@Req() req: Request, @Param("id") id: string, @Param("decision") d: string, @Body() body: unknown) {
    return this.vendors.staffDecideProvider(req.userId!, validate(Uuid, id), validate(z.enum(["verify", "reject"]), d), validate(DecisionBody, body ?? {}).reason);
  }
  @Roles("staff", "admin") @HttpCode(200) @Post("listings/:id/:decision")
  listing(@Req() req: Request, @Param("id") id: string, @Param("decision") d: string, @Body() body: unknown) {
    return this.vendors.staffDecideListing(req.userId!, validate(Uuid, id), validate(z.enum(["approve", "reject"]), d), validate(DecisionBody, body ?? {}).reason);
  }
  @Roles("staff", "admin") @Get("vendor-queue") queue() { return this.vendors.pendingForStaff(); }
}

const A = "provider";
apiRoute({ method: "get", path: "/v1/provider/taxonomy", tag: A, summary: "Provider types, categories and type-specific fields", auth: true });
apiRoute({ method: "get", path: "/v1/provider/me", tag: A, summary: "My provider account (null when none)", auth: true });
apiRoute({ method: "post", path: "/v1/provider", tag: A, summary: "Create my provider account", auth: true, body: CreateProviderBody });
apiRoute({ method: "patch", path: "/v1/provider", tag: A, summary: "Update my provider profile", auth: true, body: PatchProviderBody });
apiRoute({ method: "post", path: "/v1/provider/verification", tag: A, summary: "Submit licence details for verification", auth: true, body: VerificationBody, status: 200 });
apiRoute({ method: "get", path: "/v1/provider/dashboard", tag: A, summary: "Provider dashboard figures", auth: true });
apiRoute({ method: "post", path: "/v1/provider/images/upload-url", tag: A, summary: "Phase 1: presigned upload for a logo/cover/listing photo", auth: true, body: ImageUploadUrlBody });
apiRoute({ method: "post", path: "/v1/provider/images/{fileId}/confirm", tag: A, summary: "Phase 2: get the public URL for an uploaded image", auth: true, status: 200 });
apiRoute({ method: "get", path: "/v1/provider/listings", tag: A, summary: "My services and packages", auth: true, query: ListingsQuery });
apiRoute({ method: "post", path: "/v1/provider/listings", tag: A, summary: "Create a service or package (draft)", auth: true, body: CreateListingBody });
apiRoute({ method: "get", path: "/v1/provider/listings/{id}", tag: A, summary: "One of my listings", auth: true });
apiRoute({ method: "patch", path: "/v1/provider/listings/{id}", tag: A, summary: "Edit a listing", auth: true, body: PatchListingBody });
apiRoute({ method: "post", path: "/v1/provider/listings/{id}/publish", tag: A, summary: "Validate and publish (or submit for review)", auth: true, status: 200 });
apiRoute({ method: "post", path: "/v1/provider/listings/{id}/unpublish", tag: A, summary: "Take a listing off the marketplace", auth: true, status: 200 });
apiRoute({ method: "post", path: "/v1/provider/listings/{id}/archive", tag: A, summary: "Archive a listing", auth: true, status: 200 });
apiRoute({ method: "post", path: "/v1/provider/listings/{id}/duplicate", tag: A, summary: "Copy a listing as a draft", auth: true });
apiRoute({ method: "delete", path: "/v1/provider/listings/{id}", tag: A, summary: "Delete a listing that has no bookings", auth: true, status: 204 });
apiRoute({ method: "get", path: "/v1/provider/listings/{id}/availability", tag: A, summary: "Weekly windows and blackout dates", auth: true });
apiRoute({ method: "put", path: "/v1/provider/listings/{id}/availability", tag: A, summary: "Replace availability", auth: true, body: AvailabilityBody });
apiRoute({ method: "get", path: "/v1/provider/bookings", tag: A, summary: "Bookings for my listings", auth: true, query: BookingsQuery });
apiRoute({ method: "get", path: "/v1/provider/bookings/{id}", tag: A, summary: "One booking", auth: true });
apiRoute({ method: "post", path: "/v1/provider/bookings/{id}/{action}", tag: A, summary: "Confirm, decline, complete or cancel a booking", auth: true, status: 200 });
apiRoute({ method: "get", path: "/v1/listings", tag: "catalog", summary: "Discover published services and packages", auth: true, query: DiscoverQuery });
apiRoute({ method: "get", path: "/v1/listings/facets", tag: "catalog", summary: "Provider types and categories that have listings", auth: true });
apiRoute({ method: "get", path: "/v1/listings/{id}", tag: "catalog", summary: "Service or package detail", auth: true });
apiRoute({ method: "get", path: "/v1/listings/{id}/slots", tag: "catalog", summary: "Bookable times on a date", auth: true, query: SlotsQuery });
apiRoute({ method: "post", path: "/v1/listings/{id}/bookings", tag: "bookings", summary: "Book a listing (Idempotency-Key honoured)", auth: true, body: BookListingBody });
apiRoute({ method: "post", path: "/v1/staff/providers/{id}/{decision}", tag: "staff", summary: "Verify or reject a provider (staff/admin)", auth: true, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/listings/{id}/{decision}", tag: "staff", summary: "Approve or reject a listing in review (staff/admin)", auth: true, status: 200 });
apiRoute({ method: "get", path: "/v1/staff/vendor-queue", tag: "staff", summary: "Providers and listings awaiting review (staff/admin)", auth: true });
