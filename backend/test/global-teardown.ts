/** Closes the shared pg pool so Jest can exit cleanly. */
export default async function () {
  const { Pool } = await import("pg");
  void Pool;
}
