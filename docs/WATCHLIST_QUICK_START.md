# Watch List Feature - Quick Start Guide

**Status**: Phase 1.1 Complete & Integrated ✅
**Last Updated**: November 14, 2025

This guide gets you up and running with the Watch List feature in under 10 minutes.

---

## 🚀 Quick Start (5 Steps)

### 1. Install Dependencies

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install --legacy-peer-deps
```

**Note**: We use `--legacy-peer-deps` due to React 19 migration.

### 2. Set Up Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env and set these REQUIRED variables:
# - DATABASE_URL (PostgreSQL connection string)
# - SESSION_SECRET (generate with: openssl rand -base64 32)
# - CSRF_SECRET (generate with: openssl rand -base64 32)
# - DISCOURSE_SSO_SECRET (generate with: openssl rand -base64 32)
```

**Minimum .env for Development**:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/price_db
SESSION_SECRET=your-32-char-secret-here-min-32-chars
CSRF_SECRET=another-32-char-secret-here-min-32
DISCOURSE_SSO_SECRET=third-32-char-secret-here-min-32
APP_URL=http://localhost:5000
```

### 3. Run Database Migration

```bash
npm run migrate
```

**What this does**:
- Creates `watch_lists` table
- Updates `product_watches` table
- Adds indexes and triggers
- Creates default lists for existing users

**Verify it worked**:
```bash
# Connect to your database and run:
psql $DATABASE_URL -c "SELECT * FROM watch_lists;"
```

### 4. Start the Application

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm run build
npm start
```

### 5. Test the Feature

1. Navigate to `http://localhost:5000`
2. Log in (or create an account)
3. Click **"Watch Lists"** in the header (with 📁♥ icon)
4. You should see the Watch List Manager page with your default "My Watches" list

**Success!** 🎉 The feature is now live.

---

## 📍 Where Things Are

### Frontend (Client)

```
client/src/
├── components/
│   ├── community/                    # Watch list components
│   │   ├── watch-list-manager.tsx   # Main page
│   │   ├── watch-list-card.tsx      # List display
│   │   ├── watch-list-product-card.tsx  # Product card
│   │   ├── bulk-action-toolbar.tsx  # Bulk operations
│   │   ├── create-watch-list-dialog.tsx
│   │   ├── edit-watch-list-dialog.tsx
│   │   └── import-export-buttons.tsx
│   ├── lazy/
│   │   └── index.ts                 # LazyWatchListManager export
│   └── ui/
│       └── collapsible.tsx          # Radix UI wrapper
├── hooks/
│   └── use-community.ts             # 11 watch list hooks
├── App.tsx                          # Route: /watchlists (line 73-79)
└── components/new-header.tsx        # Nav link (line 45-52)
```

### Backend (Server)

```
server/
├── services/
│   └── community-service.ts         # 14 service functions
├── community-routes.ts              # 11 API endpoints
└── index.ts                         # Routes registered (line 175)
```

### Database

```
migrations/
└── 0008_add_watch_lists.sql        # Watch list schema

shared/
└── schema.ts                        # Types: WatchList, InsertWatchList
```

---

## 🧪 Quick Test Checklist

After starting the app, verify these work:

- [ ] **Navigate**: Go to `/watchlists` - page loads
- [ ] **Default List**: "My Watches" appears automatically
- [ ] **Create List**: Click "Create New List" → works
- [ ] **Watch Product**: Go to Products page → click Watch button
- [ ] **View Product**: Product appears in default list
- [ ] **Edit Product**: Expand card → edit category/notes/priority
- [ ] **Bulk Actions**: Select multiple → move to another list
- [ ] **Export**: Click Export → JSON file downloads
- [ ] **Import**: Click Import → select JSON → imports successfully

**All working?** You're ready to go! ✅

---

## 🔧 Common Issues & Fixes

### "tsx: not found" when running migration

**Solution**: Dependencies not installed.
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install --legacy-peer-deps
```

### "DATABASE_URL environment variable is not set"

**Solution**: Create `.env` file with `DATABASE_URL`.
```bash
cp .env.example .env
# Edit .env and set DATABASE_URL
```

### "relation 'watch_lists' does not exist"

**Solution**: Migration hasn't run.
```bash
npm run migrate
```

### Migration says "already exists"

**Good news**: Migration already ran successfully. Verify:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM watch_lists;"
```

### Page shows 404 for /watchlists

**Solution**: Rebuild the frontend.
```bash
npm run build
```

### Components won't load / Blank page

**Solution**: Check browser console for errors. Likely causes:
1. Backend not running (`npm run dev` in server terminal)
2. CORS issues (check backend logs)
3. Missing component files (run: `ls client/src/components/community/watch-list-*.tsx`)

### "Cannot find module" TypeScript errors

**Solution**: Types not exported. Verify:
```bash
# Should show WatchList and InsertWatchList exports
grep "export.*WatchList" shared/schema.ts
```

---

## 🎯 API Endpoints Reference

All endpoints require authentication.

### Lists Management

```
POST   /api/community/watch-lists          # Create list
GET    /api/community/watch-lists          # Get all user's lists
GET    /api/community/watch-lists/:id      # Get specific list
PATCH  /api/community/watch-lists/:id      # Update list
DELETE /api/community/watch-lists/:id      # Delete list
```

### Products Management

```
GET    /api/community/watch-lists/:id/products     # Get products in list
PATCH  /api/community/product-watches/:id          # Update product watch
POST   /api/community/product-watches/bulk-move    # Move products
POST   /api/community/product-watches/bulk-delete  # Delete products
```

### Import/Export

```
GET    /api/community/watch-lists/export   # Export all lists as JSON
POST   /api/community/watch-lists/import   # Import lists from JSON
```

**Example Request** (Create List):
```bash
curl -X POST http://localhost:5000/api/community/watch-lists \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Black Friday Deals",
    "description": "Items to buy on Black Friday",
    "color": "#FF5733",
    "icon": "🎉"
  }'
```

---

## 📊 Database Schema Quick Reference

### watch_lists Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | User who owns the list |
| name | VARCHAR(255) | Display name |
| description | TEXT | Optional description |
| color | VARCHAR(7) | Hex color (e.g., #FF5733) |
| icon | VARCHAR(50) | Emoji or icon name |
| is_default | BOOLEAN | True for default list |
| sort_order | INTEGER | Custom ordering |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### product_watches Table (Extended)

| New Column | Type | Description |
|------------|------|-------------|
| watch_list_id | INTEGER | References watch_lists.id |
| category | VARCHAR(100) | User-defined category |
| notes | TEXT | User notes |
| priority | INTEGER | 1-5 (5 = highest) |
| target_price | DECIMAL | Desired price |
| updated_at | TIMESTAMP | Last update |

---

## 🎨 UI Component Props

### WatchListManager

```tsx
import { WatchListManager } from '@/components/community/watch-list-manager';

// No props required - fully self-contained
<WatchListManager />
```

### WatchListCard

```tsx
import { WatchListCard } from '@/components/community/watch-list-card';

<WatchListCard
  list={watchList}           // WatchList object
  onEdit={() => {}}          // Edit callback
  onDelete={() => {}}        // Delete callback
  onExport={() => {}}        // Export callback
/>
```

### WatchListProductCard

```tsx
import { WatchListProductCard } from '@/components/community/watch-list-product-card';

<WatchListProductCard
  watch={productWatch}       // ProductWatch object
  availableLists={lists}     // WatchList[] for move dropdown
  isSelected={false}         // Checkbox state
  onSelectionChange={(id, selected) => {}}  // Selection callback
/>
```

---

## 🔌 React Hooks Usage

### Fetch All Lists

```tsx
import { useWatchLists } from '@/hooks/use-community';

function MyComponent() {
  const { data, isLoading, error } = useWatchLists();

  const lists = data?.data || [];

  return (
    <div>
      {lists.map(list => (
        <div key={list.id}>{list.name} ({list.watchCount})</div>
      ))}
    </div>
  );
}
```

### Create New List

```tsx
import { useCreateWatchList } from '@/hooks/use-community';
import { useToast } from '@/hooks/use-toast';

function CreateButton() {
  const { toast } = useToast();
  const createMutation = useCreateWatchList();

  const handleCreate = () => {
    createMutation.mutate({
      name: "My New List",
      description: "Description here",
      color: "#3B82F6",
      icon: "📋"
    }, {
      onSuccess: () => {
        toast({ title: "List created!" });
      }
    });
  };

  return <button onClick={handleCreate}>Create List</button>;
}
```

### Update Product Watch

```tsx
import { useUpdateProductWatch } from '@/hooks/use-community';

function ProductEditor({ watchId }) {
  const updateMutation = useUpdateProductWatch();

  const handleUpdate = (updates) => {
    updateMutation.mutate({
      id: watchId,
      data: {
        category: "Electronics",
        notes: "Wait for sale",
        priority: 5,
        targetPrice: 99.99
      }
    });
  };

  return <button onClick={handleUpdate}>Save</button>;
}
```

---

## 🚦 Next Steps

### For Development
1. ✅ Complete this quick start
2. 📖 Read `WATCHLIST_PHASE_1_COMPLETE.md` for full testing
3. 🧪 Run through the 60+ test checkpoints
4. 📱 Test responsive design on mobile
5. 🎨 Customize colors/styling if needed

### For Production
1. ✅ Complete development testing
2. 🔒 Review security settings (.env secrets)
3. 🗄️ Set up production database (with backups)
4. 📊 Configure monitoring/analytics
5. 🚀 Deploy and monitor

### For Phase 2 (Real-time Notifications)
1. ✅ Phase 1 fully tested and stable
2. 📡 Research WebSocket libraries (Socket.io, ws)
3. 🔔 Plan notification preferences UI
4. 📧 Set up email service (SMTP)
5. 🧪 Design notification testing strategy

---

## 📚 Additional Resources

- **Full Documentation**: `WATCHLIST_PHASE_1_COMPLETE.md`
- **Integration Guide**: `WATCHLIST_INTEGRATION.md`
- **Roadmap**: `WATCHLIST_IMPROVEMENTS.md`
- **Database Migration**: `migrations/0008_add_watch_lists.sql`
- **Component Guide**: `docs/COMPONENT_GUIDE.md`
- **API Reference**: `server/community-routes.ts`

---

## 💬 Support

**Questions?**
- Check the troubleshooting section above
- Review component source code in `client/src/components/community/`
- Check browser console for frontend errors
- Check server logs for backend errors

**Found a bug?**
- Check if migration ran successfully
- Verify all files exist
- Check TypeScript compilation errors
- Review browser network tab for API errors

---

**Happy coding! 🎉**

This feature provides a solid foundation for Phase 2 (Real-time Notifications) and beyond.
