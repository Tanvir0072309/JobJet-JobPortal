// Sends push notifications through Expo's push service. No API key/account
// setup needed on our side - Expo handles the actual APNs/FCM delivery for
// any app built with expo-notifications, we just POST to their HTTP API
// with the device's Expo push token.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(token) {
  return typeof token === "string" && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

// Fire-and-forget by design (callers don't need to await success): a failed
// push should never break the email-reply-check flow it's attached to.
async function sendPushNotification(pushToken, { title, body, data } = {}) {
  if (!isExpoPushToken(pushToken)) return { sent: false, reason: "invalid_token" };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: "default",
        priority: "high",
      }),
    });

    const result = await response.json().catch(() => null);
    const ticket = result?.data;
    if (ticket?.status === "error") {
      console.error("Expo push ticket error:", ticket.message || ticket);
      return { sent: false, reason: ticket.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("Failed to send push notification:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendPushNotification, isExpoPushToken };
