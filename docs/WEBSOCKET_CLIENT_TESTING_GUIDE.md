# WebSocket Client Testing Guide

This guide provides step-by-step instructions for testing the WebSocket client system for Watch List Phase 2.1 - Real-time frontend integration.

## Quick Summary

**Created Files (770 lines total)**:
- `client/src/lib/websocket-client.ts` (312 lines) - Singleton WebSocket manager
- `client/src/hooks/use-websocket.ts` (55 lines) - Core WebSocket connection hook
- `client/src/hooks/use-watchlist-updates.ts` (121 lines) - Watch list real-time updates
- `client/src/hooks/use-notification-updates.ts` (140 lines) - Notification real-time updates
- `client/src/components/connection-status.tsx` (57 lines) - Connection status indicator
- `client/src/components/notification-badge.tsx` (31 lines) - Real-time notification badge
- `client/src/components/price-update-indicator.tsx` (54 lines) - Price update animation

**Modified Files**:
- `client/src/App.tsx` - Integrated WebSocket hooks and ConnectionStatus component

## Prerequisites

1. **Server Running**: Ensure the server is running with WebSocket support:
   ```bash
   npm run dev
   ```

2. **User Account**: Create a test user account for authentication testing

3. **Browser DevTools**: Open browser console to see WebSocket connection logs

## Testing Checklist

### 1. Connection Management

#### Test 1.1: Initial Connection
**Steps**:
1. Open the app in browser (http://localhost:5000)
2. Log in with test account
3. Open browser console

**Expected Results**:
- Console shows: `📡 WebSocket state: connecting`
- Console shows: `✅ WebSocket connected`
- Console shows: `🔐 WebSocket authenticated for user {userId}`
- No connection status indicator visible (hidden when connected)

**Success Criteria**: ✅ WebSocket connects successfully after login

---

#### Test 1.2: Auto-Reconnection
**Steps**:
1. While logged in, stop the server (`Ctrl+C`)
2. Observe connection status indicator
3. Wait 2-3 seconds
4. Restart server (`npm run dev`)

**Expected Results**:
- Orange "Reconnecting..." indicator appears when server stops
- Console shows reconnection attempts with exponential backoff
- Connection automatically restores when server restarts
- Indicator disappears when reconnected

**Success Criteria**: ✅ Auto-reconnection works with exponential backoff

---

#### Test 1.3: Offline/Online Detection
**Steps**:
1. Open browser DevTools → Network tab
2. Click "Offline" to simulate network loss
3. Wait 2 seconds
4. Uncheck "Offline" to restore network

**Expected Results**:
- Red "Connection lost" indicator appears when offline
- Console shows: `📡 Network offline - WebSocket connection lost`
- Connection auto-restores when back online
- Console shows: `🌐 Network online - reconnecting WebSocket...`

**Success Criteria**: ✅ Handles online/offline transitions gracefully

---

#### Test 1.4: Logout Disconnect
**Steps**:
1. While logged in and connected, log out
2. Check browser console

**Expected Results**:
- WebSocket disconnects cleanly
- Console shows: `📡 WebSocket state: disconnected`
- No reconnection attempts after logout

**Success Criteria**: ✅ WebSocket disconnects on logout

---

### 2. Watch List Real-Time Updates

#### Test 2.1: Create Watch List in Another Tab
**Steps**:
1. Open app in **two browser tabs** (same user)
2. In **Tab 1**: Navigate to `/watchlists`
3. In **Tab 2**: Keep `/watchlists` page open
4. In **Tab 1**: Create a new watch list named "Test List"

**Expected Results**:
- **Tab 2** instantly shows new watch list without refresh
- Toast notification appears: "Watch list created - Test List has been created"
- React Query cache invalidated automatically

**Success Criteria**: ✅ Watch list creation syncs across tabs in real-time

---

#### Test 2.2: Add Product to Watch List
**Steps**:
1. Open app in **two browser tabs**
2. Both tabs viewing same watch list
3. In **Tab 1**: Add a product to the watch list
4. Observe **Tab 2**

**Expected Results**:
- **Tab 2** shows new product instantly
- Toast notification: "Product added - {product name} added to watch list"
- Product count updates in real-time

**Success Criteria**: ✅ Product additions sync instantly across tabs

---

#### Test 2.3: Remove Product from Watch List
**Steps**:
1. Open watch list in two tabs
2. In **Tab 1**: Remove a product
3. Observe **Tab 2**

**Expected Results**:
- **Tab 2** updates instantly (product disappears)
- No toast notification for removals (less intrusive)
- Product count updates

**Success Criteria**: ✅ Product removals sync silently

---

#### Test 2.4: Delete Watch List
**Steps**:
1. Open `/watchlists` in two tabs
2. In **Tab 1**: Delete a watch list
3. Observe **Tab 2**

**Expected Results**:
- **Tab 2** removes watch list from view instantly
- Red toast notification: "Watch list deleted - {name} has been deleted"

**Success Criteria**: ✅ Watch list deletion syncs with visual feedback

---

### 3. Notification Real-Time Updates

#### Test 3.1: Notification Badge Updates
**Steps**:
1. Log in and observe notification bell icon
2. Trigger a notification (price alert, watch list update, etc.)
3. Check notification badge

**Expected Results**:
- Badge appears with unread count
- Badge animates with pulse effect
- Count updates instantly when new notification arrives
- Sound plays for high-priority notifications (if browser allows)

**Success Criteria**: ✅ Notification badge updates in real-time

---

#### Test 3.2: Price Alert Notifications
**Steps**:
1. Create a price alert for a product
2. Manually trigger price update on server (or wait for scheduled job)
3. Observe notification behavior

**Expected Results**:
- Toast appears: "💰 Price Alert! - {notification content}"
- Notification sound plays
- Unread count increments
- Notification appears in notifications list

**Success Criteria**: ✅ Price alerts trigger real-time notifications

---

#### Test 3.3: Mark Notification as Read
**Steps**:
1. Have unread notifications (badge shows count)
2. Mark a notification as read
3. Observe badge

**Expected Results**:
- Unread count decrements instantly
- Badge updates without page refresh
- If count reaches 0, badge disappears

**Success Criteria**: ✅ Read status syncs in real-time

---

### 4. Connection Status Indicator

#### Test 4.1: Visual States
**Steps**:
1. Test all connection states:
   - **Connecting**: Refresh page while logged in
   - **Reconnecting**: Stop/restart server
   - **Disconnected**: Go offline or log out

**Expected Results**:
- **Connecting**: Yellow badge with spinning loader icon
- **Reconnecting**: Orange badge with spinning refresh icon
- **Disconnected**: Red badge with WiFi-off icon
- **Connected**: Indicator hidden completely

**Success Criteria**: ✅ All connection states display correctly

---

#### Test 4.2: Indicator Position
**Steps**:
1. Trigger disconnection state
2. Check indicator location

**Expected Results**:
- Indicator appears in bottom-right corner
- Fixed positioning (stays visible when scrolling)
- Z-index 50 (appears above most content)
- Smooth slide-in animation

**Success Criteria**: ✅ Indicator positioned correctly

---

### 5. Browser Console Testing

#### Test 5.1: Access WebSocket Client from Console
**Steps**:
1. Open browser console
2. Type: `window.websocketClient`
3. Try: `window.websocketClient.getState()`

**Expected Results**:
- WebSocket client object accessible (only in development)
- `getState()` returns current state: `"connected"`, `"disconnected"`, etc.

**Success Criteria**: ✅ WebSocket client exposed for debugging

---

#### Test 5.2: Manual Event Testing
**Steps**:
1. In browser console, run:
   ```javascript
   window.websocketClient.emit('subscribe:watchlists')
   ```
2. Create a watch list on server

**Expected Results**:
- Subscription confirmed
- Events received in real-time
- Console logs show event data

**Success Criteria**: ✅ Manual event emission works

---

#### Test 5.3: Connection State Monitoring
**Steps**:
1. In console, run:
   ```javascript
   window.websocketClient.onStateChange((state) => {
     console.log('State changed to:', state);
   })
   ```
2. Disconnect/reconnect network

**Expected Results**:
- State changes logged: `disconnected` → `reconnecting` → `connected`
- Callback fires for each state transition

**Success Criteria**: ✅ State change listeners work

---

### 6. Error Handling

#### Test 6.1: Authentication Failure
**Steps**:
1. Log out
2. Try to connect manually:
   ```javascript
   window.websocketClient.connect()
   ```

**Expected Results**:
- Connection fails with 401 error
- Console shows: `⚠️  WebSocket authentication failed - user may not be logged in`
- No reconnection attempts (authentication errors don't trigger retry)

**Success Criteria**: ✅ Authentication errors handled gracefully

---

#### Test 6.2: Max Reconnect Attempts
**Steps**:
1. Log in (WebSocket connects)
2. Stop server permanently
3. Wait ~5 minutes (10 reconnection attempts)

**Expected Results**:
- Reconnection attempts logged with increasing delays
- After 10 attempts, stops trying
- Console shows: `❌ Max reconnection attempts reached. Giving up.`
- Connection state: `disconnected`

**Success Criteria**: ✅ Max reconnect attempts prevents infinite retries

---

#### Test 6.3: Network Errors Don't Crash App
**Steps**:
1. Disconnect network while app is running
2. Interact with UI (navigate, click buttons)
3. Reconnect network

**Expected Results**:
- App remains functional during disconnection
- UI shows disconnected state but doesn't freeze
- No JavaScript errors in console
- Connection restores automatically

**Success Criteria**: ✅ App resilient to network errors

---

### 7. Multi-Tab Testing

#### Test 7.1: Shared Connection State
**Steps**:
1. Open app in 3 tabs
2. Log in to all tabs
3. Check console in each tab

**Expected Results**:
- Each tab has its own WebSocket connection
- All tabs receive same events
- State syncs across all tabs via React Query cache invalidation

**Success Criteria**: ✅ Multi-tab support works correctly

---

#### Test 7.2: Logout in One Tab
**Steps**:
1. Open app in 2 tabs
2. Log out in **Tab 1**
3. Observe **Tab 2**

**Expected Results**:
- **Tab 1** disconnects WebSocket
- **Tab 2** remains connected (separate session)
- Each tab manages own connection lifecycle

**Success Criteria**: ✅ Independent tab connection management

---

### 8. Performance Testing

#### Test 8.1: Connection Overhead
**Steps**:
1. Open browser DevTools → Performance tab
2. Start recording
3. Log in (triggers WebSocket connection)
4. Stop recording after 5 seconds

**Expected Results**:
- WebSocket connection completes in <500ms
- No noticeable UI lag during connection
- Memory usage stable (no leaks)

**Success Criteria**: ✅ Minimal performance impact

---

#### Test 8.2: Event Handling Performance
**Steps**:
1. Connect to WebSocket
2. Trigger multiple rapid events (create 10 watch lists quickly)
3. Observe UI responsiveness

**Expected Results**:
- All events processed without dropped frames
- React Query throttles refetches appropriately
- UI remains responsive

**Success Criteria**: ✅ Handles event bursts gracefully

---

### 9. Edge Cases

#### Test 9.1: Page Refresh During Reconnection
**Steps**:
1. Disconnect network
2. Wait for "Reconnecting..." indicator
3. Refresh page before reconnection completes

**Expected Results**:
- Page reloads cleanly
- No zombie connections
- New connection established after reload

**Success Criteria**: ✅ Clean state on page refresh

---

#### Test 9.2: Server Restart During Active Use
**Steps**:
1. Have watch list page open
2. Restart server (`Ctrl+C` then `npm run dev`)
3. Don't refresh page

**Expected Results**:
- Connection lost indicator appears
- Auto-reconnects when server ready
- Page state preserved (no data loss)
- Cached data still visible during reconnection

**Success Criteria**: ✅ Survives server restarts gracefully

---

## Browser Compatibility

Test in multiple browsers:
- ✅ Chrome 120+ (primary target)
- ✅ Firefox 120+
- ✅ Safari 17+
- ✅ Edge 120+

**Note**: Notification sounds may not work in all browsers due to autoplay policies. This is expected behavior.

---

## Known Limitations

1. **Notification Sounds**: Only play after user interaction (browser autoplay policy)
2. **Multiple Tabs**: Each tab maintains separate WebSocket connection (expected)
3. **Mobile Browsers**: Connection may drop when app backgrounded (OS limitation)

---

## Troubleshooting

### Issue: WebSocket won't connect
**Solution**:
1. Check user is logged in
2. Verify server is running on port 5000
3. Check browser console for errors
4. Try hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+F5`)

### Issue: No real-time updates
**Solution**:
1. Check connection state: `window.websocketClient.getState()`
2. Verify subscriptions in console
3. Check server logs for event emissions
4. Clear browser cache and reload

### Issue: Connection status indicator stuck
**Solution**:
1. Check React Query DevTools for stale queries
2. Refresh page
3. Check server is responding to WebSocket requests

---

## Success Criteria Summary

All tests should pass with these results:
- ✅ WebSocket connects automatically on login
- ✅ Auto-reconnection works with exponential backoff
- ✅ Watch list updates appear instantly across tabs
- ✅ Notification badge updates in real-time
- ✅ Price alerts trigger notifications
- ✅ Connection status visible to users
- ✅ Handles offline/online transitions
- ✅ No memory leaks (event listeners cleaned up)
- ✅ Works across modern browsers
- ✅ No app crashes on WebSocket errors

---

## Next Steps

After successful testing:
1. Deploy to staging environment
2. Test with production-like data volumes
3. Monitor WebSocket connection metrics
4. Optimize reconnection delays based on usage patterns
5. Add E2E tests for critical flows

---

## Debugging Commands

```javascript
// Check connection state
window.websocketClient.getState()

// Check if connected
window.websocketClient.isConnected()

// Manual connection
window.websocketClient.connect()

// Manual disconnection
window.websocketClient.disconnect()

// Subscribe to state changes
window.websocketClient.onStateChange((state) => console.log('State:', state))

// Emit event (testing only)
window.websocketClient.emit('subscribe:watchlists')
```

---

**Last Updated**: 2025-11-21
**Version**: 1.0.0
**Phase**: Watch List Phase 2.1 - Real-time Frontend Integration
