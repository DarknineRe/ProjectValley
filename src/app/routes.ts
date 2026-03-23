import { createBrowserRouter, redirect } from "react-router";
import { Layout } from "./components/layout";
import { Marketplace } from "./pages/marketplace";
import { Inventory } from "./pages/inventory";
import { InventorySummary } from "./pages/inventory-summary";
import { PlantingCalendar } from "./pages/planting-calendar";
import { ActivityLog } from "./pages/activity-log";
import { Members } from "./pages/members";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { Hub } from "./pages/hub";
import { Profile } from "./pages/profile";
import { PriceSearch } from "./pages/price-search";
import { Requests } from "./pages/requests";

export const router = createBrowserRouter([
  {
    path: "/",
    loader: () => redirect("/login"),
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/hub",
    Component: Hub,
  },
  {
    path: "/profile",
    Component: Profile,
  },
  {
    path: "/price-search",
    loader: () => redirect("/workspace/price-search"),
  },
  {
    path: "/workspace",
    Component: Layout,
    children: [
      { index: true, loader: () => redirect("/workspace/marketplace") },
      { path: "marketplace", Component: Marketplace },
      { path: "inventory", Component: Inventory },
      { path: "summary", Component: InventorySummary },
      { path: "price-search", Component: PriceSearch },
      { path: "calendar", Component: PlantingCalendar },
      { path: "members", Component: Members },
      { path: "activity", Component: ActivityLog },
      { path: "requests", Component: Requests },
    ],
  },
  {
    path: "*",
    loader: () => redirect("/login"),
  },
]);