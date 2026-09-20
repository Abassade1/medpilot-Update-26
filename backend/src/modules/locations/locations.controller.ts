import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { validate } from "../../common/validate";
import { apiRoute } from "../../docs/registry";
import { LocationsService } from "./locations.service";

const Uuid = z.string().uuid();
const ChildrenQ = z.object({ parentId: Uuid.optional(), coveredBy: Uuid.optional() });
const ResolveQ = z.object({
  country: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
});
const AvailabilityQ = z.object({ locationId: Uuid });

@Controller("v1")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get("locations")
  children(@Query() q: unknown) {
    const { parentId, coveredBy } = validate(ChildrenQ, q);
    return this.locations.children(parentId, coveredBy);
  }

  @Get("locations/resolve")
  resolve(@Query() q: unknown) {
    return this.locations.resolve(validate(ResolveQ, q));
  }

  @Get("transport/availability")
  availability(@Query() q: unknown) {
    return this.locations.availability(validate(AvailabilityQ, q).locationId);
  }
}

apiRoute({ method: "get", path: "/v1/locations", tag: "catalog", summary: "Countries, or the children of a place; optionally only places a provider serves", auth: true });
apiRoute({ method: "get", path: "/v1/locations/resolve", tag: "catalog", summary: "Match geocoded country/region/city names onto the location tree", auth: true });
apiRoute({ method: "get", path: "/v1/transport/availability", tag: "catalog", summary: "Which transport services can reach a place", auth: true });
