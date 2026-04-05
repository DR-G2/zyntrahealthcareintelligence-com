import { Link } from 'react-router-dom';
import { Lock, Zap, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  variant?: 'card' | 'banner' | 'overlay';
  stage?: number;
}

export function UpgradePrompt({ feature, description, variant = 'card', stage }: UpgradePromptProps) {
  const stageText = stage ? `Complete Stage ${stage - 1} to unlock this level` : undefined;
  const effectiveDescription = description || stageText;
  if (variant === 'banner') {
    return (
      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {effectiveDescription || `${feature} is available on the Full Access plan`}
          </span>
        </div>
        <Button asChild size="sm" className="gap-1">
          <Link to="/pricing">Upgrade <ArrowRight className="h-3 w-3" /></Link>
        </Button>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
        <div className="text-center space-y-3 max-w-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg">{feature}</h3>
          <p className="text-sm text-muted-foreground">
            {description || 'Upgrade to Full Access to unlock this feature'}
          </p>
          <Button asChild className="gap-1">
            <Link to="/pricing">View Plans <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-display font-bold">{feature}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {description || 'This feature requires the Full Access plan'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-primary" />
          Starting at $39/month
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link to="/pricing">Upgrade to Full Access <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
