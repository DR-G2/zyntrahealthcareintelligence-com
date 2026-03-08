import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface StationChecklistProps {
  type: 'examination' | 'investigations' | 'management';
  items: ChecklistItem[];
  onItemToggle: (id: string) => void;
  managementPlanText?: string;
  onManagementPlanChange?: (text: string) => void;
  disabled?: boolean;
}

const typeConfig = {
  examination: {
    title: 'Physical Examination',
    description: 'Select the examinations you would perform on this patient.',
    icon: '🩺',
  },
  investigations: {
    title: 'Investigations',
    description: 'Select the investigations you would order.',
    icon: '🔬',
  },
  management: {
    title: 'Management Plan',
    description: 'Select appropriate management actions and write your plan.',
    icon: '📋',
  },
};

export function StationChecklist({ type, items, onItemToggle, managementPlanText, onManagementPlanChange, disabled }: StationChecklistProps) {
  const config = typeConfig[type];

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3 border-b border-border mb-3">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <span>{config.icon}</span>
          {config.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 pr-3">
          {items.map(item => (
            <label
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                item.checked
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border hover:border-primary/20 hover:bg-muted/50'
              } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => onItemToggle(item.id)}
                disabled={disabled}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground leading-relaxed">{item.label}</span>
            </label>
          ))}
        </div>
      </ScrollArea>

      {type === 'management' && (
        <div className="mt-4 pt-3 border-t border-border">
          <Label className="text-sm font-medium text-foreground">Management Plan Notes</Label>
          <Textarea
            value={managementPlanText || ''}
            onChange={e => onManagementPlanChange?.(e.target.value)}
            placeholder="Write your overall management approach, including follow-up plans..."
            className="mt-2 min-h-[100px]"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
