import { LazyPanelScreen } from "@/lib/lazy-screens";
import { getDefaultRestaurantSlug } from "@/lib/restaurant-demo";

export default function PanelPage() {
  return <LazyPanelScreen restaurantSlug={getDefaultRestaurantSlug()} />;
}
