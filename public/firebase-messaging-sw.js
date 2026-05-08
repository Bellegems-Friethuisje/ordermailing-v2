importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAZ0sKvRx6NWhI8kFnjzBYjeg-tsvwmsHY",
  projectId: "ordermailing-v2",
  messagingSenderId: "620399020333",
  appId: "1:620399020333:web:9457f830b1b8854f73eba4",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon.svg",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
