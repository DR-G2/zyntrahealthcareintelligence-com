

## Plan: Admin-Initiated Messaging System

### Concept
Admin can send messages to any candidate from the admin dashboard. Candidates see a notification/inbox in the app and can reply **only** to conversations the admin started. Candidates cannot initiate new conversations with admin.

### 1. Database — Two new tables

**`admin_messages`** — stores all messages in threads

```sql
CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'candidate')),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**`admin_message_threads`** — one row per admin→candidate conversation

```sql
CREATE TABLE public.admin_message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  admin_email text NOT NULL,
  candidate_email text,
  subject text DEFAULT 'No subject',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(admin_id, candidate_id)
);
```

**RLS policies:**
- Admins (via edge function with service role) can read/write all threads and messages
- Candidates can SELECT threads where `candidate_id = auth.uid()`
- Candidates can SELECT messages where `thread_id` belongs to their thread
- Candidates can INSERT messages only into threads where they are the candidate (reply only)

### 2. Edge Function — `admin-send-message`

- Accepts `{ candidate_id, content, subject? }`
- Verifies caller is admin (same pattern as `admin-toggle-setting`)
- Creates thread if not exists, inserts message with `sender_role = 'admin'`
- Uses service role for writes

### 3. Admin Dashboard — Messages Tab

Add a new tab "Messages" in the admin dashboard (visible to all admins):
- Compose: Select a user from the user list, type a message, send
- Thread view: See conversation history with each candidate
- Unread indicator for candidate replies

### 4. Candidate Inbox — New page + sidebar link

**New page: `src/pages/Inbox.tsx`**
- Shows list of threads (from admin only)
- Click to open thread, view messages, reply
- Unread badge on new admin messages

**Sidebar update:** Add "Inbox" with a `Mail` icon and unread count badge

### 5. Realtime (optional but recommended)

Enable realtime on `admin_messages` table so both admin and candidates see new messages instantly.

### Summary

| Component | Change |
|-----------|--------|
| Migration | Create `admin_message_threads` + `admin_messages` tables with RLS |
| `supabase/functions/admin-send-message/index.ts` | New edge function for admin to send messages |
| `src/pages/Inbox.tsx` | New candidate inbox page |
| `src/pages/AdminDashboard.tsx` | Add Messages tab with compose + thread view |
| `src/components/AppSidebar.tsx` | Add Inbox link with unread badge |
| `src/App.tsx` | Add `/inbox` route |

