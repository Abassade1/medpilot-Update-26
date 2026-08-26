import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { validate } from "../../common/validate";
import { CatalogService } from "./catalog.service";
import { apiRoute } from "../../docs/registry";

const SearchQ = z.object({ q: z.string().trim().max(80).optional() });
const ProviderQ = z.object({ category: z.enum(["jet", "ambulance", "boat"]).optional() });
const PetQ = z.object({ category: z.enum(["vet", "pedicure", "sitters"]).optional() });
const Uuid = z.string().uuid();

@Controller("v1")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("home") home() { return this.catalog.home(); }

  @Get("hospitals")
  hospitals(@Query() query: unknown) {
    const { q } = validate(SearchQ, query);
    return this.catalog.listHospitals(q);
  }
  @Get("hospitals/:id") hospital(@Param("id") id: string) { return this.catalog.hospitalDetail(validate(Uuid, id)); }

  @Get("specialists/:id") specialist(@Param("id") id: string) { return this.catalog.specialistDetail(validate(Uuid, id)); }

  @Get("packages")
  packages(@Query() query: unknown) {
    const { q } = validate(SearchQ, query);
    return this.catalog.listPackages(q);
  }
  @Get("packages/:id") pkg(@Param("id") id: string) { return this.catalog.packageDetail(validate(Uuid, id)); }

  @Get("transport-providers")
  providers(@Query() query: unknown) {
    const { category } = validate(ProviderQ, query);
    return this.catalog.listProviders(category);
  }
  @Get("transport-providers/:id") provider(@Param("id") id: string) { return this.catalog.providerDetail(validate(Uuid, id)); }

  @Get("aircraft/:id") aircraft(@Param("id") id: string) { return this.catalog.aircraftDetail(validate(Uuid, id)); }

  @Get("pet-clinics")
  petClinics(@Query() query: unknown) {
    const { category } = validate(PetQ, query);
    return this.catalog.listPetClinics(category);
  }

  @Get("services") services() { return this.catalog.listServices(); }
  @Get("reference") reference() { return this.catalog.reference(); }
}

apiRoute({ method: "get", path: "/v1/home", tag: "catalog", summary: "Home screen aggregate", auth: true });
apiRoute({ method: "get", path: "/v1/hospitals", tag: "catalog", summary: "Hospital directory (searchable)", auth: true, query: SearchQ });
apiRoute({ method: "get", path: "/v1/hospitals/{id}", tag: "catalog", summary: "Hospital detail + specialists", auth: true });
apiRoute({ method: "get", path: "/v1/specialists/{id}", tag: "catalog", summary: "Specialist profile", auth: true });
apiRoute({ method: "get", path: "/v1/packages", tag: "catalog", summary: "Treatment packages", auth: true, query: SearchQ });
apiRoute({ method: "get", path: "/v1/packages/{id}", tag: "catalog", summary: "Package detail (hospital / transport / cost)", auth: true });
apiRoute({ method: "get", path: "/v1/transport-providers", tag: "catalog", summary: "Medevac providers by category", auth: true, query: ProviderQ });
apiRoute({ method: "get", path: "/v1/transport-providers/{id}", tag: "catalog", summary: "Provider detail + fleet", auth: true });
apiRoute({ method: "get", path: "/v1/aircraft/{id}", tag: "catalog", summary: "Aircraft detail", auth: true });
apiRoute({ method: "get", path: "/v1/pet-clinics", tag: "catalog", summary: "Pet clinics by category", auth: true, query: PetQ });
apiRoute({ method: "get", path: "/v1/services", tag: "catalog", summary: "Service categories", auth: true });
apiRoute({ method: "get", path: "/v1/reference", tag: "catalog", summary: "Reference lists for forms and AUX chips", auth: true });
