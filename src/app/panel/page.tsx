import { PanelScreen } from "@/components/panel-screen";
import { getDefaultRestaurantSlug } from "@/lib/restaurant-demo";

export default function PanelPage() {
  return <PanelScreen restaurantSlug={getDefaultRestaurantSlug()} basePath="" />;
}
