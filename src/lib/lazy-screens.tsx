import dynamic from "next/dynamic";
import { PanelRouteSkeleton } from "@/components/ui/route-skeleton";

export const LazyPanelScreen = dynamic(
  () => import("@/components/panel-screen").then((mod) => ({ default: mod.PanelScreen })),
  { loading: () => <PanelRouteSkeleton /> }
);
