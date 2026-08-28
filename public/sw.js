self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Pass-through to network
});

self.addEventListener('push', function(event) {
  if (!event.data) return;

  event.waitUntil(
    (async function() {
      try {
        const data = event.data.json();
        const chatId = data.chat_id || data.data?.chat_id || 'default';
        const senderName = data.sender_name || data.title || 'AlaText';
        const newMsgText = data.body || '';
        const tag = `chat_${chatId}`;

        // Fetch existing active notification for this chat thread
        const existingNotifs = await self.registration.getNotifications({ tag });
        let messages = [newMsgText];

        if (existingNotifs && existingNotifs.length > 0) {
          const oldData = existingNotifs[0].data || {};
          if (Array.isArray(oldData.messages)) {
            messages = [...oldData.messages, newMsgText];
          } else if (existingNotifs[0].body) {
            messages = [existingNotifs[0].body, newMsgText];
          }
        }

        // Format combined multiline notification body (showing up to 4 recent message lines)
        const recentMsgs = messages.slice(-4);
        const combinedBody = recentMsgs.join('\n');
        const count = messages.length;
        const title = count > 1 ? `${senderName} (${count} new messages)` : senderName;

        const options = {
          body: combinedBody,
          icon: '/icon.png',
          badge: '/icon.png',
          tag: tag,
          renotify: true,
          data: {
            url: data.url || `/chat?id=${chatId}`,
            chat_id: chatId,
            messages: messages,
          },
        };

        await self.registration.showNotification(title, options);
      } catch (e) {
        console.error('Push notification bundling error:', e);
      }
    })()
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(event.notification.data?.url || '/') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});
