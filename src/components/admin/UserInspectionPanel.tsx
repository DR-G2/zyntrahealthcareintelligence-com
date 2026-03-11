import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, Activity, Brain, Clock, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserInspectionPanelProps {
  userId: string | null;
  email?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserInspectionPanel({ userId, email, open, onOpenChange }: UserInspectionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId || !open) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('admin-inspect-user', {
          body: { user_id: userId },
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        setData(result);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      }
      setLoading(false);
    };
    fetch();
  }, [userId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {email || 'User Details'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="text-muted-foreground text-center py-12">No data available</p>
        ) : (
          <Tabs defaultValue="profile" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile" className="text-xs"><User className="h-3.5 w-3.5 mr-1" />Profile</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Stats</TabsTrigger>
              <TabsTrigger value="history" className="text-xs"><Clock className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
              <TabsTrigger value="behavior" className="text-xs"><Brain className="h-3.5 w-3.5 mr-1" />Behavior</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {[
                    ['Name', data.profile?.name],
                    ['Email', data.profile?.email],
                    ['Country', data.profile?.country_of_origin],
                    ['Grad Country', data.profile?.country_of_graduation],
                    ['College', data.profile?.medical_college],
                    ['Grad Year', data.profile?.graduation_year],
                    ['Location', data.profile?.current_location],
                    ['Exam Stage', data.profile?.exam_stage],
                    ['Exam Date', data.profile?.exam_date],
                    ['Joined', data.profile?.created_at ? new Date(data.profile.created_at).toLocaleDateString() : null],
                    ['Last Active', data.presence?.last_seen_at ? new Date(data.presence.last_seen_at).toLocaleString() : null],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{(value as string) || '—'}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {[
                    ['Total Questions', data.stats?.total_attempts],
                    ['Today', data.stats?.today_attempts],
                    ['Accuracy', data.stats?.accuracy != null ? `${Math.round(data.stats.accuracy)}%` : null],
                    ['Avg Time', data.stats?.avg_time != null ? `${Math.round(data.stats.avg_time)}s` : null],
                    ['Answer Changes', data.stats?.total_changes],
                    ['OSCE Stations', data.stats?.total_osce],
                    ['Streak Days', data.stats?.streak_days],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value ?? '—'}</span>
                    </div>
                  ))}

                  {data.stats?.subject_breakdown && Object.keys(data.stats.subject_breakdown).length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">By Subject</p>
                      {Object.entries(data.stats.subject_breakdown).map(([subject, stats]: [string, any]) => (
                        <div key={subject} className="flex justify-between text-xs py-0.5">
                          <span className="text-muted-foreground">{subject}</span>
                          <span>{stats.correct}/{stats.total} ({Math.round((stats.correct / stats.total) * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {data.recent_attempts?.length > 0 ? data.recent_attempts.map((a: any) => (
                    <Card key={a.id}>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium line-clamp-2">{a.question_text}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant={a.is_correct ? 'default' : 'destructive'} className="text-[10px]">
                            {a.is_correct ? 'Correct' : 'Wrong'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                          <span className="text-[10px] text-muted-foreground">{a.time_taken_seconds}s</span>
                          <span className="text-[10px] text-muted-foreground">{a.answer_changes_count} changes</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] mt-1">
                          Answer: <strong>{a.selected_answer}</strong> · Correct: <strong>{a.correct_answer}</strong>
                        </p>
                      </CardContent>
                    </Card>
                  )) : (
                    <p className="text-center text-muted-foreground text-sm py-8">No attempts found</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="behavior">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {data.behavior ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Archetype</span>
                        <Badge>{data.behavior.archetype}</Badge>
                      </div>
                      {data.behavior.trap_flags && Array.isArray(data.behavior.trap_flags) && data.behavior.trap_flags.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Behavioral Signals</p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.behavior.trap_flags.map((flag: any, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{typeof flag === 'string' ? flag : flag.type || flag.label || JSON.stringify(flag)}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.performance && (
                        <div className="pt-3 border-t space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Performance DNA</p>
                          {[
                            ['Clinical Accuracy', data.performance.clinical_accuracy],
                            ['Stability', data.performance.stability_score],
                            ['Confidence Gap', data.performance.confidence_gap],
                            ['Time Sensitivity', data.performance.time_sensitivity],
                            ['Readiness', data.performance.readiness_score],
                          ].map(([label, val]) => (
                            <div key={label as string} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium">{val != null ? val : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-4">No behavior data</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
