import { Helmet } from 'react-helmet-async';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';

export default function SettingsNotificationsPage() {
  return (
    <>
      <Helmet>
        <title>Notification Settings | PriceCompare</title>
        <meta name="description" content="Manage notification preferences" />
      </Helmet>

      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Notification Preferences</h1>
          <p className="text-muted-foreground">Control how and when you receive notifications</p>
        </div>

        <NotificationPreferences />
      </div>
    </>
  );
}
