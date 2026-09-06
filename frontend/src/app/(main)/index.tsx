import { Redirect } from "expo-router";

// The inbox (emails + attachments) is the first screen after login now —
// not the dashboard, and not the applications list.
export default function MainIndex() {
  return <Redirect href="/(main)/emails" />;
}
