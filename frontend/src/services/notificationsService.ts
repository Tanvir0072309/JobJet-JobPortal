import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Foreground notifications (company-reply pings) should still show a banner
// and play a sound while the app is open, not just appear silently in the
// tray - this is what makes that happen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Asks for notification permission (if not already granted/denied) and
// returns this device's Expo push token, or null if permission was refused
// or we're not on a physical device (push tokens don't work in simulators).
//
// NOTE: as of Expo SDK 55+, push notifications on Android require a
// development build / standalone APK - they no longer work inside Expo Go.
// iOS works in Expo Go. See https://docs.expo.dev/push-notifications/overview/
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse.data;
  } catch (err) {
    console.warn("Could not get Expo push token:", err instanceof Error ? err.message : err);
    return null;
  }
}
