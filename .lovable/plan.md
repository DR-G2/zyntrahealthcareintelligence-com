

## Plan: Add SubtopicManager Component

### New File: `src/components/admin/SubtopicManager.tsx`

Create a component mirroring the existing `SubjectManager` pattern but for subtopics:

- **Subject selector**: A `<Select>` dropdown at the top to pick which subject's subtopics to manage
- **Add subtopic**: Input + button to add a new subtopic under the selected subject
- **List**: Scrollable list of subtopics for the selected subject, each row showing name, display order badge, and hover-visible edit/delete buttons
- **Inline rename**: Same edit-in-place pattern as SubjectManager (Input + Check/X buttons)
- **Delete confirmation**: AlertDialog before deleting

All CRUD calls go through `supabase.functions.invoke('admin-manage-questions', { body: { action: 'manage_subtopic', ... } })` which already supports `list`, `add`, `rename`, `delete` actions.

### Update: `src/components/admin/QNSTab.tsx`

- Import `SubtopicManager`
- Render it directly below the `SubjectManager` in the MCQ create tab (line ~136), passing the same `subjects` array

### No backend changes needed
The `manage_subtopic` actions already exist in the edge function from the previous implementation.

