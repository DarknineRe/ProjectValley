import { createBrowserRouter, redirect } from "react-router";
import { Layout } from "./components/layout";
import { Marketplace } from "./pages/marketplace";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { Hub } from "./pages/hub";
import { Profile } from "./pages/profile";

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
    loader: () => redirect("/workspace/marketplace"),
  },
  {
    path: "/workspace",
    Component: Layout,
    children: [
      { index: true, loader: () => redirect("/workspace/marketplace") },
      { path: "marketplace", Component: Marketplace },
    ],
  },
  {
    path: "*",
    loader: () => redirect("/login"),
  },
]);