import { LazyPanelScreen } from "@/lib/lazy-screens";
import { getDefaultRestaurantSlug } from "@/lib/restaurant-demo";

export default function RestaurantPanelPage({ params }: { params: { restaurantSlug: string } }) {
  const slug = decodeURIComponent(params.restaurantSlug).trim();
  return <LazyPanelScreen restaurantSlug={slug} />;
}
