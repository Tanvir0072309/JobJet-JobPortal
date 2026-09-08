import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/LoadingState";

// Entry point: send authenticated users straight to the Mail/inbox screen
// (the required first page after login), everyone else to the Welcome
// screen. This must stay in sync with (main)/index.tsx, which handles the
// same redirect whenever someone navigates to "/(main)" directly.
export default function Index() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) return <LoadingState label="Starting JobJet..." />;

  return <Redirect href={isAuthenticated ? "/(main)/emails" : "/welcome"} />;
}
