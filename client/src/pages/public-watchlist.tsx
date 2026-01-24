import { useParams, Link } from 'wouter';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { ShopProvider } from '@/context/shop-context';
import { usePublicWatchList } from '@/hooks/use-community';

function PublicWatchlistContent() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = usePublicWatchList(token ?? null);

  return (
    <div className="bg-background min-h-screen">
      <TemplateHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{data?.name ?? 'Public Watchlist'}</h1>
          <Link href="/shop" className="text-primary hover:underline">
            Back to Shop
          </Link>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-destructive">Watchlist not found</div>
        ) : data && data.products.length === 0 ? (
          <div className="text-muted-foreground">No products in this watchlist.</div>
        ) : (
          <div className="space-y-3">
            {data?.products.map((p) => (
              <div
                key={p.id}
                className="border-border flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.productName ?? 'Unnamed product'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <TemplateFooter />
    </div>
  );
}

export default function PublicWatchlistPage() {
  return (
    <ShopProvider>
      <PublicWatchlistContent />
    </ShopProvider>
  );
}
