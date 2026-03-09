

## Plan: Flag Shared IP Addresses in Admin Dashboard

### What

Detect when multiple users share the same IP address and visually flag them in the admin Live Activity table with a warning badge. This is a client-side computation — no backend changes needed since IP addresses are already returned by `admin-live-stats`.

### Changes

#### `src/components/admin/LiveActivityTab.tsx`

1. **Build a shared-IP map** in a `useMemo`: group all users by `ip_address`, then collect IPs where 2+ users share the same IP. Store as `Map<string, string[]>` (IP → array of user names/emails).

2. **Flag shared IPs in the table**: In the IP Address cell, if the user's IP exists in the shared-IP map:
   - Show an `AlertTriangle` icon (from lucide-react) in orange/amber
   - Add a `Badge` with "Shared" label styled as destructive
   - Show a tooltip or inline text listing the other users on that same IP

3. **Add a summary alert at the top**: If any shared IPs are detected, show a small warning banner above the table: "⚠ {N} IP addresses shared by multiple accounts" that can be clicked to filter the table to only show flagged users.

4. **Add filter toggle**: A button/toggle to filter the table to only show users with shared IPs for quick piracy review.

### Implementation Detail

```typescript
// Compute shared IPs
const sharedIpMap = useMemo(() => {
  const ipUsers: Record<string, UserStats[]> = {};
  for (const s of stats) {
    if (!s.ip_address) continue;
    if (!ipUsers[s.ip_address]) ipUsers[s.ip_address] = [];
    ipUsers[s.ip_address].push(s);
  }
  // Only keep IPs with 2+ users
  const shared: Record<string, UserStats[]> = {};
  for (const [ip, users] of Object.entries(ipUsers)) {
    if (users.length >= 2) shared[ip] = users;
  }
  return shared;
}, [stats]);
```

### Files Changed

| File | Change |
|------|--------|
| `src/components/admin/LiveActivityTab.tsx` | Add shared-IP detection, warning badges, filter toggle |

