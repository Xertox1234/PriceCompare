import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Helmet } from 'react-helmet-async';

export default function NotificationsPage() {
  return (
    <>
      <Helmet>
        <title>Notifications | PriceCompare</title>
        <meta name="description" content="View your smart price alerts and notifications" />
      </Helmet>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Smart price alerts and updates for products you're watching
          </p>
        </div>

        <NotificationCenter />
      </div>
    </>
  );
}
