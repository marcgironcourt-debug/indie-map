self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'Indie Map'

  const body = typeof payload.body === 'string' && payload.body.trim()
    ? payload.body.trim()
    : 'Tu as une nouvelle notification.'

  const url = typeof payload.url === 'string' && payload.url.trim()
    ? payload.url.trim()
    : '/fr'

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url,
      target: typeof payload.target === 'string' ? payload.target : ''
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification && event.notification.data
    ? event.notification.data.url
    : '/fr'

  const targetUrl = new URL(rawUrl || '/fr', self.location.origin).href

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })

    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) {
          await client.navigate(targetUrl)
        }
        return
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl)
    }
  })())
})
