import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/LoadingState";

// Entry point: send authenticated users straight to Applications (the
// required first page after login), everyone else to Login.
export default function Index() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) return <LoadingState label="Starting JobJet..." />;

  return <Redirect href={isAuthenticated ? "/(main)/applications" : "/login"} />;
}
