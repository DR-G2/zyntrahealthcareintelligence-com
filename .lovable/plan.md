

## Plan: OSCE Toggle via Admin Site Settings

### Approach
Add a new `osce_enabled` site setting that controls whether OSCE pages show content or an "under construction" page. The admin can toggle this on/off from the existing Site Settings card.

### Changes

**1. Seed new site setting row**
- Insert `osce_enabled` with value `false` into `site_settings` table (using insert tool, not migration)

**2. Add setting to admin config (`src/pages/AdminDashboard.tsx`)**
- Add entry to `SITE_SETTINGS_CONFIG` array:
  `{ key: 'osce_enabled', label: 'OSCE Module', description: 'Enable/disable OSCE stations for all users', defaultValue: false }`

**3. Add hook (`src/hooks/useSiteSettings.ts`)**
- Add `useOSCEEnabled()` hook that reads the `osce_enabled` setting

**4. Create `src/components/OSCEUnderConstruction.tsx`**
- Centered card with stethoscope icon
- Medical pun headline: *"This section is under surgery — we'll have it sutured up soon!"*
- Back to Dashboard button

**5. Update OSCE pages to conditionally render**
- `src/pages/Stations.tsx` — if `!osceEnabled`, render `<OSCEUnderConstruction />`
- `src/pages/QuestionsOSCE.tsx` — same
- `src/pages/DiagnosticOSCE.tsx` — same

Each page wraps in `AppLayout` and checks the hook. When the admin flips the toggle on, OSCE works normally. When off, users see the pun page.

| File | Action |
|------|--------|
| `site_settings` table | Insert `osce_enabled = false` row |
| `src/pages/AdminDashboard.tsx` | Add to `SITE_SETTINGS_CONFIG` |
| `src/hooks/useSiteSettings.ts` | Add `useOSCEEnabled` hook |
| `src/components/OSCEUnderConstruction.tsx` | Create under-construction component |
| `src/pages/Stations.tsx` | Gate behind `osce_enabled` |
| `src/pages/QuestionsOSCE.tsx` | Gate behind `osce_enabled` |
| `src/pages/DiagnosticOSCE.tsx` | Gate behind `osce_enabled` |

