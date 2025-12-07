# Watch List Integration Guide

This guide explains how to integrate the new Watch List Management feature into your PriceCompare application.

## Prerequisites

- Phase 1.1 implementation is complete (database migration, backend, hooks, UI components)
- Database migration has been run: `npm run db:migrate`

## Step 1: Add Route to Application

The app uses **Wouter** for routing. Add the watch list route to `client/src/App.tsx`:

### Option A: Direct Import (Recommended for Testing)

```tsx
// Add to imports at the top of App.tsx
import { WatchListManager } from "@/components/community/watch-list-manager";

// Add inside the <Switch> component (around line 38)
<Route path="/watchlists">
  <RouteErrorBoundary>
    <WatchListManager />
  </RouteErrorBoundary>
</Route>
```

### Option B: Lazy Loading (Recommended for Production)

1. **Add to lazy components file** (`client/src/components/lazy/index.tsx` or create if not exists):

```tsx
import { lazy } from 'react';

export const LazyWatchListManager = lazy(
  () => import('@/components/community/watch-list-manager').then(m => ({ default: m.WatchListManager }))
);
```

2. **Import and use in App.tsx**:

```tsx
// Add to imports
import { LazyWatchListManager } from "@/components/lazy";

// Add inside the <Switch> component
<Route path="/watchlists">
  <RouteErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      <LazyWatchListManager />
    </Suspense>
  </RouteErrorBoundary>
</Route>
```

## Step 2: Add Navigation Link

Add a link to the watch list page in your navigation header (`client/src/components/new-header.tsx` or wherever your nav is):

```tsx
<Link href="/watchlists">
  <a className="nav-link">My Watch Lists</a>
</Link>
```

Or with an icon:

```tsx
import { FolderHeart } from 'lucide-react';

<Link href="/watchlists">
  <Button variant="ghost">
    <FolderHeart className="w-4 h-4 mr-2" />
    Watch Lists
  </Button>
</Link>
```

## Step 3: Update Existing WatchButton (Optional)

To allow users to select which list to add products to when clicking "Watch", you can enhance the existing `WatchButton` component:

### Current Behavior
- Adds products to the default watch list

### Enhanced Behavior (Optional Future Enhancement)
- Shows a dropdown to select which list to add the product to
- Defaults to the user's default list
- Can be enhanced in Phase 1.2 or later

For now, the existing behavior works fine - products are added to the default "My Watches" list and can be moved to other lists from the WatchListManager page.

## Step 4: Test the Integration

1. **Navigate to the route**: Visit `http://localhost:5000/watchlists` (or your dev URL)

2. **Verify features work**:
   - [ ] Page loads without errors
   - [ ] Default "My Watches" list is visible
   - [ ] Can create new lists
   - [ ] Can edit list names, colors, icons
   - [ ] Products appear if you have any watched items
   - [ ] Can edit product metadata (category, notes, priority, target price)
   - [ ] Bulk selection works
   - [ ] Can move products between lists
   - [ ] Can delete products
   - [ ] Export downloads a JSON file
   - [ ] Import can read the exported file

3. **Check authentication**: The page requires login - verify it redirects to login if not authenticated

## Step 5: Run Database Migration (If Not Done)

If you haven't run the migration yet:

```bash
# Navigate to project root
cd /home/user/PriceCompare

# Run migration
npm run db:migrate

# Or with the specific migration file
psql $DATABASE_URL -f migrations/0008_add_watch_lists.sql
```

This will create:
- `watch_lists` table
- Update `product_watches` table with new columns
- Create triggers and materialized views
- Set up default lists for existing users

## Verification Checklist

After integration, verify:

- [ ] Route is accessible at `/watchlists`
- [ ] Navigation link works
- [ ] Page requires authentication
- [ ] Database tables exist (watch_lists, updated product_watches)
- [ ] Default list was auto-created for existing users
- [ ] All CRUD operations work (create, read, update, delete)
- [ ] Bulk operations work (move, delete)
- [ ] Import/export functionality works
- [ ] Toast notifications appear for actions
- [ ] Loading states show correctly
- [ ] Error states display properly
- [ ] Responsive on mobile/tablet

## Troubleshooting

### "Table does not exist" error
**Solution**: Run the database migration (Step 5)

### "Component not found" error
**Solution**: Verify all component files exist in `client/src/components/community/`

### "Hooks not working" error
**Solution**: Verify `client/src/hooks/use-community.ts` has all the new hooks

### API endpoints return 404
**Solution**: Verify backend routes are registered in `server/index.ts` or main server file

### Products don't show in lists
**Solution**:
1. Check that products have been watched (use existing WatchButton)
2. Verify they have a `watch_list_id` (should auto-populate to default list)
3. Check console for API errors

## Optional Enhancements

### Add to User Profile Menu
If you have a user profile dropdown, add:

```tsx
<DropdownMenuItem asChild>
  <Link href="/watchlists">
    <FolderHeart className="w-4 h-4 mr-2" />
    My Watch Lists
  </Link>
</DropdownMenuItem>
```

### Add Badge with Count
Show number of watched items:

```tsx
import { useWatchLists } from '@/hooks/use-community';

const { data } = useWatchLists();
const totalWatched = data?.data.reduce((sum, list) => sum + list.watchCount, 0) || 0;

<Link href="/watchlists">
  Watch Lists {totalWatched > 0 && <Badge>{totalWatched}</Badge>}
</Link>
```

### Add to Dashboard
Create a dashboard widget showing recent watches:

```tsx
import { useWatchLists } from '@/hooks/use-community';

export function RecentWatchesWidget() {
  const { data } = useWatchLists();
  const lists = data?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Watch Lists</CardTitle>
      </CardHeader>
      <CardContent>
        {lists.slice(0, 3).map(list => (
          <div key={list.id}>
            {list.icon} {list.name} ({list.watchCount} items)
          </div>
        ))}
        <Link href="/watchlists">View All →</Link>
      </CardContent>
    </Card>
  );
}
```

## Next Steps

After successful integration:

1. **Test with real users** - Get feedback on UX
2. **Monitor performance** - Check database query performance with large lists
3. **Consider Phase 1.2** - Add search and filtering features
4. **Mobile optimization** - Test and refine mobile experience
5. **Analytics** - Track feature usage and engagement

## Support

For issues or questions:
- Check `WATCHLIST_IMPROVEMENTS.md` for implementation details
- Review component source code in `client/src/components/community/`
- Check API documentation in `server/community-routes.ts`

---

**Last Updated**: 2025-11-14
**Version**: Phase 1.1 Complete
**Status**: Ready for Integration
