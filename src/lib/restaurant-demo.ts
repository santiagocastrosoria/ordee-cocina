export function getRestaurantSlug() {
  const raw =
    typeof process !== "undefined"
      ? process.env.RESTAURANT_SLUG || process.env.NEXT_PUBLIC_RESTAURANT_SLUG || ""
      : "";

  const s = String(raw).trim();

  return s || "demo-ordee";
}
