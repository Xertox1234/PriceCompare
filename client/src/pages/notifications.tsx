import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';

export default function NotificationsPage() {
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <>
      <Helmet>
        <title>Notifications | PriceCompare</title>
        <meta name="description" content="View your smart price alerts and notifications" />
      </Helmet>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <h1 className="mb-2 text-3xl font-bold">Notifications</h1>
          <Button type="button" variant="outline" onClick={() => setShowPreferences((v) => !v)}>
            Preferences
          </Button>
          <p className="text-muted-foreground">
            Smart price alerts and updates for products you're watching
          </p>
        </div>

        {showPreferences ? (
          <div className="mb-8">
            <NotificationPreferences />
          </div>
        ) : null}

        <NotificationCenter />
      </div>
    </>
  );
}
