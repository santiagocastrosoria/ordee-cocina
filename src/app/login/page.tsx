import { StaffLoginScreen } from "@/components/staff-login-screen";
import { getDefaultRestaurantSlug } from "@/lib/restaurant-demo";

export default function StaffLoginPage() {
  return <StaffLoginScreen restaurantSlug={getDefaultRestaurantSlug()} basePath="" />;
}
