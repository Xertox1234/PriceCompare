import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Helmet } from 'react-helmet-async';

export default function NotificationsPage() {
  return (
    <>
      <Helmet>
        <title>Notifications | PriceCompare</title>
        <meta name="description" content="View your smart price alerts and notifications" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-muted-foreground">
            Smart price alerts and updates for products you're watching
          </p>
        </div>

        <NotificationCenter />
      </div>
    </>
  );
}
