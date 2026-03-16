import { Stethoscope, Construction, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function OSCEUnderConstruction() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardContent className="py-12 px-8 space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <div className="relative">
              <Stethoscope className="h-10 w-10 text-primary" />
              <Construction className="h-5 w-5 text-warning absolute -bottom-1 -right-1" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display">
              Under Surgery 🩺
            </h2>
            <p className="text-lg text-muted-foreground">
              This section is under surgery — we'll have it <span className="font-semibold text-primary">sutured</span> up soon!
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Our OSCE module is being carefully operated on. No need to scrub in — we've got this covered.
          </p>

          <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
