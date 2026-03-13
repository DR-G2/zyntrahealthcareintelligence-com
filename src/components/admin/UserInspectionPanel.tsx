import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, User, Activity, Brain, Clock, Ban, RotateCcw, Trash2, Key, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SUPER_ADMIN_EMAIL = "gopalrock.naren@gmail.com";

const EXAM_TARGET_LABELS: Record<string, string> = {
  amc_mcq: 'AMC MCQ',
  amc_clinical: 'AMC Clinical',
  plab: 'PLAB',
  usmle: 'USMLE',
  other: 'Other',
};

const BOOKING_LABELS: Record<string, string> = {
  booked: 'Booked',
  planning: 'Planning',
  not_yet: 'Not Yet',
};

interface UserInspectionPanelProps {
  userId: string | null;
  email?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserEmail?: string;
  onUserUpdated?: () => void;
}

export function UserInspectionPanel({ userId, email, open, onOpenChange, currentUserEmail, onUserUpdated }: UserInspectionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL;
  const isTargetSuperAdmin = email === SUPER_ADMIN_EMAIL;

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

  const executeAction = async (action: string, extraBody: Record<string, unknown> = {}) => {
    if (!userId) return;
    setActionLoading(action);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-actions', {
        body: { action, user_id: userId, ...extraBody },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      toast({ title: 'Success', description: `Action "${action}" completed` });
      onUserUpdated?.();
      const { data: refreshed } = await supabase.functions.invoke('admin-inspect-user', { body: { user_id: userId } });
      if (refreshed && !refreshed.error) setData(refreshed);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const isBanned = data?.profile?.is_banned;
  const sub = data?.subscription;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {email || 'User Details'}
            {isBanned && <Badge variant="destructive">Banned</Badge>}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="text-muted-foreground text-center py-12">No data available</p>
        ) : (
          <>
            {/* Admin Action Buttons */}
            {!isTargetSuperAdmin && (
              <div className="flex flex-wrap gap-2 mt-4 mb-2 p-3 rounded-lg border bg-muted/30">
                {isBanned ? (
                  <Button variant="outline" size="sm" onClick={() => executeAction('unban')} disabled={!!actionLoading}>
                    {actionLoading === 'unban' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Unban
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={!!actionLoading}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Ban User
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ban {email}?</AlertDialogTitle>
                        <AlertDialogDescription>This will ban the user and invalidate their session.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => executeAction('ban', { reason: 'Admin action' })}>Ban User</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                <Button variant="outline" size="sm" onClick={() => executeAction('reset_password')} disabled={!!actionLoading}>
                  {actionLoading === 'reset_password' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <Key className="h-3.5 w-3.5 mr-1" /> Reset Password
                </Button>

                {isSuperAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={!!actionLoading}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete User
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {email}?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the user and ALL their data. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { executeAction('delete_user'); onOpenChange(false); }}>Delete User</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}

            <Tabs defaultValue="profile" className="mt-2">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile" className="text-xs"><User className="h-3.5 w-3.5 mr-1" />Profile</TabsTrigger>
                <TabsTrigger value="subscription" className="text-xs"><CreditCard className="h-3.5 w-3.5 mr-1" />Sub</TabsTrigger>
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
                      ['User ID', userId],
                      ['Status', data.profile?.is_banned ? 'Banned' : 'Active'],
                      ['Country', data.profile?.country_of_origin],
                      ['Grad Country', data.profile?.country_of_graduation],
                      ['College', data.profile?.medical_college],
                      ['Grad Year', data.profile?.graduation_year],
                      ['Location', data.profile?.current_location],
                      ['Exam Stage', data.profile?.exam_stage],
                      ['Exam Target', data.profile?.exam_target ? (EXAM_TARGET_LABELS[data.profile.exam_target] || data.profile.exam_target) : null],
                      ['AMC1 Score', data.profile?.amc1_score],
                      ['AMC2 Booking', data.profile?.amc2_booking_status ? (BOOKING_LABELS[data.profile.amc2_booking_status] || data.profile.amc2_booking_status) : null],
                      ['Exam Date', data.profile?.exam_date],
                      ['Exam Location', data.profile?.exam_location],
                      ['Joined', data.profile?.created_at ? new Date(data.profile.created_at).toLocaleDateString() : null],
                      ['Last Active', data.presence?.last_seen_at ? new Date(data.presence.last_seen_at).toLocaleString() : null],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-medium ${label === 'Status' && value === 'Banned' ? 'text-destructive' : ''}`}>
                          {(value as string) || '—'}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="subscription">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={sub?.status === 'active' ? 'default' : 'secondary'}>
                        {sub?.status === 'active' ? 'Active' : 'Free'}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Tier</span>
                      <Badge variant="outline" className="capitalize">{sub?.tier || 'free'}</Badge>
                    </div>
                    {sub?.subscription_end && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Expiry</span>
                          <span className="font-medium">{new Date(sub.subscription_end).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground">Days Remaining</span>
                          <span className={`font-bold ${sub.days_remaining != null && sub.days_remaining <= 3 ? 'text-amber-500' : ''}`}>
                            {sub.days_remaining != null ? `${sub.days_remaining} days` : '—'}
                          </span>
                        </div>
                      </>
                    )}
                    {!sub?.subscription_end && sub?.status === 'active' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expiry</span>
                        <span className="font-medium text-emerald-500">Lifetime / No expiry</span>
                      </div>
                    )}
                    {sub?.source && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Source</span>
                        <span className="font-medium capitalize">{sub.source.replace('_', ' ')}</span>
                      </div>
                    )}
                    {sub?.granted_by && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Granted By</span>
                        <span className="font-medium">{sub.granted_by}</span>
                      </div>
                    )}
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
