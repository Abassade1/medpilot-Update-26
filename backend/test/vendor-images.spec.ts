import { closeApp, http, jpegBytes, registerUser } from "./helpers";
afterAll(closeApp);

const auth = (t: string) => ["Authorization", t] as const;

async function uploadImage(token: string, bytes = jpegBytes()) {
  const ticket = await (await http()).post("/v1/provider/images/upload-url").set(...auth(token))
    .send({ mimeType: "image/jpeg", sizeBytes: bytes.length }).expect(201);
  const putToken = ticket.body.uploadUrl.split("/v1/uploads/")[1];
  await (await http()).put(`/v1/uploads/${putToken}`).set("Content-Type", "image/jpeg").send(bytes).expect(200);
  return ticket.body.fileId as string;
}

describe("provider/listing image uploads", () => {
  it("uploads through the two-phase flow and returns a public, cacheable URL", async () => {
    const u = await registerUser();
    const fileId = await uploadImage(u.auth);
    const confirmed = await (await http()).post(`/v1/provider/images/${fileId}/confirm`).set(...auth(u.auth)).expect(200);
    expect(confirmed.body.url).toContain("/v1/files/");

    const served = await (await http()).get(confirmed.body.url.replace(/^https?:\/\/[^/]+/, "")).expect(200);
    expect(served.headers["content-type"]).toBe("image/jpeg");
    expect(served.headers["cache-control"]).toContain("public");
    expect(served.headers["content-disposition"]).toBe("inline");
    // never the private-file behaviour used for PHI downloads
    expect(served.headers["cache-control"]).not.toContain("no-store");
    // without this, the institutional web portal (a different origin) can't embed the image at
    // all — Chrome silently drops it as ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
    expect(served.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("can be used as a provider's logo/cover and a listing's images", async () => {
    const u = await registerUser();
    const logoId = await uploadImage(u.auth);
    const logo = (await (await http()).post(`/v1/provider/images/${logoId}/confirm`).set(...auth(u.auth)).expect(200)).body.url;

    const provider = await (await http()).post("/v1/provider").set(...auth(u.auth))
      .send({ type: "private_nurse", name: "Riverside Home Care", description: "Compassionate in-home nursing for post-surgical recovery and chronic care.", country: "Canada", city: "Calgary", logoUrl: logo })
      .expect(201);
    expect(provider.body.provider.logoUrl).toBe(logo);

    const photoId = await uploadImage(u.auth);
    const photo = (await (await http()).post(`/v1/provider/images/${photoId}/confirm`).set(...auth(u.auth)).expect(200)).body.url;
    const listing = await (await http()).post("/v1/provider/listings").set(...auth(u.auth))
      .send({
        kind: "service", name: "In-home wound care", category: "home_nursing", subcategory: "wound_care", description: "One-on-one wound care and medication management in your home.",
        priceAmount: 9000, priceType: "fixed", durationMinutes: 60, capacity: 1, locationModes: ["home"], country: "Canada", city: "Calgary",
        images: [photo],
      })
      .expect(201);
    expect(listing.body.images).toEqual([photo]);
  });

  it("rejects a file over the size limit before issuing a ticket", async () => {
    const u = await registerUser();
    const res = await (await http()).post("/v1/provider/images/upload-url").set(...auth(u.auth))
      .send({ mimeType: "image/jpeg", sizeBytes: 9 * 1024 * 1024 }).expect(413);
    expect(res.body.error.code).toBe("file_too_large");
  });

  it("rejects a non-image type", async () => {
    const u = await registerUser();
    const res = await (await http()).post("/v1/provider/images/upload-url").set(...auth(u.auth))
      .send({ mimeType: "application/pdf", sizeBytes: 100 }).expect(422);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("won't confirm someone else's uploaded file", async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const fileId = await uploadImage(owner.auth);
    await (await http()).post(`/v1/provider/images/${fileId}/confirm`).set(...auth(intruder.auth)).expect(404);
  });
});
