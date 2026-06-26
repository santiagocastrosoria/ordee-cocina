import { PanelScreen } from "@/components/panel-screen";
import { staffBasePathForSlug } from "@/lib/restaurant-routes";

export default function RestaurantPanelPage({ params }: { params: { restaurantSlug: string } }) {
  const slug = decodeURIComponent(params.restaurantSlug).trim();
  return <PanelScreen restaurantSlug={slug} basePath={staffBasePathForSlug(slug)} />;
}
