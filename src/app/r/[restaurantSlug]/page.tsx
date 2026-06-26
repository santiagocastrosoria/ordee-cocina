import { StaffLoginScreen } from "@/components/staff-login-screen";
import { staffBasePathForSlug } from "@/lib/restaurant-routes";

export default function RestaurantStaffLoginPage({ params }: { params: { restaurantSlug: string } }) {
  const slug = decodeURIComponent(params.restaurantSlug).trim();
  return <StaffLoginScreen restaurantSlug={slug} basePath={staffBasePathForSlug(slug)} />;
}
