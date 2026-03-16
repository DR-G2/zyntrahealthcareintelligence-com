

## Plan: Rich MCQ Question Editor with Image Support

### Current State
The MCQ tab in AdminDashboard uses plain `Textarea` for question text, JSON editing for options, and basic `Input` fields. No image support, no rich text, no subject management.

### Implementation

**Phase 1-2: Rich Text Editor Component**

Create a lightweight rich text editor using `contentEditable` div with a simple toolbar (bold, italic, lists, image insert). No heavy library needed — a custom `RichTextEditor` component using `document.execCommand` covers the requirements while keeping bundle size minimal.

The editor stores content as HTML string, which maps directly to the existing `question_text` field (backwards-compatible — plain text is valid HTML).

**Phase 3-4: Image Upload & Storage**

Create a `question-images` storage bucket (public, 2MB limit). The image upload flow:
1. Admin clicks "Insert Image" in toolbar
2. File picker opens (accepts PNG/JPG/WEBP)
3. Image uploaded to `question-images/{timestamp}_{filename}`
4. Public URL returned and inserted as `<img>` tag in the editor

**Phase 5: Option Editor with Image Support**

Replace the JSON textarea for options with 5 individual fields (A-E), each with a small text input and an "attach image" button. Options stored as array of objects: `{ text: string, image_url?: string }`.

**Phase 6: Subject Management**

Create a `subjects` table:
```sql
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```
Seed with existing CATEGORIES. Add a "Manage Subjects" card in the MCQ tab for rename/add/delete/reorder. The CATEGORIES constant becomes dynamic, loaded from DB.

**Phase 7: New Question Creator**

Add a "Create Question" button that opens a full-page editor (not a modal) with:
- Subject selector (from `subjects` table)
- Rich text question stem editor
- 5 option fields with image support
- Correct answer selector (radio)
- Rich text explanation editor
- Difficulty + subtopic selectors
- Save button → inserts via `admin-manage-questions` with `action: 'create'`

**Phase 8: Enhanced Edit View**

Replace the existing edit dialog with the same full editor layout, pre-populated with the question data.

**Phase 9: Admin Edge Function Update**

Add `action: 'create'` to `admin-manage-questions` edge function to support inserting new questions with all fields.

### Files

| File | Action |
|------|--------|
| Migration SQL | Create `question-images` storage bucket + `subjects` table with seed data + RLS |
| `src/components/admin/RichTextEditor.tsx` | Create — contentEditable editor with toolbar |
| `src/components/admin/MCQEditor.tsx` | Create — full question create/edit form |
| `src/components/admin/SubjectManager.tsx` | Create — subject CRUD UI |
| `src/pages/AdminDashboard.tsx` | Replace MCQTab internals to use new components |
| `supabase/functions/admin-manage-questions/index.ts` | Add `create` action |

### Design Decisions
- **No TipTap/Quill** — a custom `contentEditable` component avoids adding ~100KB+ to the bundle while covering paragraphs, bold, lists, and image insertion
- **HTML storage** — `question_text` field already accepts text; HTML is a superset. Existing plain-text questions render fine. The practice UI renders with `dangerouslySetInnerHTML` (or react-markdown already imported)
- **No schema migration for question_text** — it's already `text` type, HTML strings fit
- Zero AI usage — all operations are direct DB reads/writes

