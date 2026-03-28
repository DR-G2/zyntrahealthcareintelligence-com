import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainingNotifications, TrainingNotification } from '@/hooks/useTrainingNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ADMIN_EMAILS } from '@/lib/admin-emails';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Bell, BellOff, BellRing, CheckCheck, X, TrendingUp, Target, Brain, Clock,
  BookOpen, Award, Flame, PlayCircle, Repeat, Zap, CalendarIcon,
  Filter, Send, Users, ArrowRight, Trash2, Smartphone,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  'trending-up': TrendingUp, target: Target, brain: Brain, clock: Clock,
  'book-open': BookOpen, award: Award, flame: Flame, 'play-circle': PlayCircle,
  repeat: Repeat, zap: Zap,
};

const categoryConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  performance: { label: 'Performance', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  session_performance: { label: 'Session', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  behavior: { label: 'Behavior', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  behavior_stability: { label: 'Stability', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  training_nudge: { label: 'Training', color: 'text-primary', bgColor: 'bg-primary/10' },
  inactivity: { label: 'Re-engage', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10' },
  content: { label: 'Content', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10' },
  admin: { label: 'Admin', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500/10' },
};

function NotificationIcon({ icon }: { icon: string | null }) {
  const Icon = iconMap[icon || 'zap'] || Zap;
  return <Icon className="h-4 w-4" />;
}

// ── Admin Broadcast Panel ──
function AdminBroadcastPanel() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('content');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaRoute, setCtaRoute] = useState('');
  const [targetScope, setTargetScope] = useState<'all' | 'free' | 'paid'>('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Missing fields', description: 'Title and body are required.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-send-notification', {
        body: {
          title: title.trim(),
          body: body.trim(),
          category,
          cta_label: ctaLabel.trim() || null,
          cta_route: ctaRoute.trim() || null,
          target_scope: targetScope,
        },
      });
      if (error) throw error;
      toast({ title: 'Notification sent', description: `Sent to ${data?.sent_to || 0} users.` });
      setTitle(''); setBody(''); setCtaLabel(''); setCtaRoute('');
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-purple-500/20 bg-purple-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4 text-purple-500" />
          Broadcast Notification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Notification title" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Notification body — be specific, actionable, and concise." value={body} onChange={e => setBody(e.target.value)} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="content">Content Update</SelectItem>
              <SelectItem value="training_nudge">Training Nudge</SelectItem>
              <SelectItem value="performance">Performance Insight</SelectItem>
              <SelectItem value="admin">Admin Announcement</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetScope} onValueChange={(v) => setTargetScope(v as any)}>
            <SelectTrigger><SelectValue placeholder="Target" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="free">Free Users</SelectItem>
              <SelectItem value="paid">Paid Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="CTA label (optional)" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
          <Input placeholder="CTA route e.g. /practice" value={ctaRoute} onChange={e => setCtaRoute(e.target.value)} />
        </div>
        <Button onClick={handleSend} disabled={sending} className="w-full">
          {sending ? 'Sending...' : 'Send to Users'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Push Notification Toggle ──
function PushNotificationCard() {
  const { state, loading, subscribe, unsubscribe } = usePushNotifications();

  if (state === 'unsupported') return null;

  const isSubscribed = state === 'subscribed';
  const isDenied = state === 'denied';

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="h-4 w-4 text-primary" />
          Browser Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {isDenied
            ? 'Browser notifications are blocked. Enable them in your browser settings.'
            : isSubscribed
              ? 'You\'ll receive push alerts for training insights even when Zyntra is closed.'
              : 'Get real-time training nudges and performance insights — even when the app isn\'t open.'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">
            {isSubscribed ? 'Enabled' : isDenied ? 'Blocked' : 'Disabled'}
          </span>
          <Switch
            checked={isSubscribed}
            disabled={isDenied || loading}
            onCheckedChange={(checked) => checked ? subscribe() : unsubscribe()}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function Notifications() {
  const { user } = useAuth();
  const { notifications, loading, unreadCount, markAsRead, markAllRead, dismiss, refresh } = useTrainingNotifications();
  const navigate = useNavigate();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Category
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      // Read status
      if (readFilter === 'unread' && n.read_at) return false;
      if (readFilter === 'read' && !n.read_at) return false;
      // Date range
      const created = new Date(n.created_at);
      if (dateRange === '24h' && isBefore(created, subDays(new Date(), 1))) return false;
      if (dateRange === '7d' && isBefore(created, subDays(new Date(), 7))) return false;
      if (dateRange === '30d' && isBefore(created, subDays(new Date(), 30))) return false;
      if (dateRange === 'custom') {
        if (customFrom && isBefore(created, startOfDay(customFrom))) return false;
        if (customTo && isAfter(created, endOfDay(customTo))) return false;
      }
      return true;
    });
  }, [notifications, categoryFilter, readFilter, dateRange, customFrom, customTo]);

  // Unique categories from user's notifications
  const categories = useMemo(() => {
    const cats = new Set(notifications.map(n => n.category));
    return Array.from(cats);
  }, [notifications]);

  const handleClick = (notif: TrainingNotification) => {
    if (!notif.read_at) markAsRead(notif.id);
    if (notif.cta_route) navigate(notif.cta_route);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Training Insights</h1>
          <p className="text-sm text-muted-foreground">
            Personalized feedback to sharpen your clinical reasoning
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={refresh}>
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: notifications.length, icon: Bell },
          { label: 'Unread', value: unreadCount, icon: BellOff },
          { label: 'Insights', value: notifications.filter(n => n.type === 'insight').length, icon: TrendingUp },
          { label: 'Nudges', value: notifications.filter(n => n.type === 'nudge').length, icon: Target },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{categoryConfig[c]?.label || c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={readFilter} onValueChange={setReadFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Date range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {customFrom ? format(customFrom, 'PP') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {customTo ? format(customTo, 'PP') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notification List */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No notifications match your filters</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Complete a practice session to receive personalized insights.</p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map(notif => {
              const config = categoryConfig[notif.category] || { label: notif.category, color: 'text-muted-foreground', bgColor: 'bg-muted' };
              return (
                <Card
                  key={notif.id}
                  className={cn(
                    'group cursor-pointer transition-all hover:shadow-md',
                    !notif.read_at && 'border-primary/20 bg-primary/[0.02]'
                  )}
                  onClick={() => handleClick(notif)}
                >
                  <CardContent className="flex gap-3 p-4">
                    {/* Icon */}
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', config.bgColor, config.color)}>
                      <NotificationIcon icon={notif.icon} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {!notif.read_at && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                          <h3 className={cn('text-sm leading-tight', !notif.read_at ? 'font-semibold' : 'font-medium text-foreground/80')}>
                            {notif.title}
                          </h3>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground/60">
                          {format(new Date(notif.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', config.bgColor, config.color)}>
                          {config.label}
                        </Badge>
                        {notif.cta_label && (
                          <span className="flex items-center gap-0.5 text-[11px] font-medium text-primary">
                            {notif.cta_label} <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.read_at && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); markAsRead(notif.id); }}>
                          <CheckCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); dismiss(notif.id); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-500/10">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                </div>
                <div><strong className="text-foreground">Performance Insights</strong> track your accuracy trends and session results.</div>
              </div>
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-500/10">
                  <Brain className="h-3 w-3 text-amber-500" />
                </div>
                <div><strong className="text-foreground">Behavioral Feedback</strong> identifies rushing, overthinking, and answer-changing patterns.</div>
              </div>
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                  <Target className="h-3 w-3 text-primary" />
                </div>
                <div><strong className="text-foreground">Training Nudges</strong> highlight your weakest subjects and recommend drills.</div>
              </div>
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-orange-500/10">
                  <Flame className="h-3 w-3 text-orange-500" />
                </div>
                <div><strong className="text-foreground">Re-engagement</strong> brings you back when consistency drops.</div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Panel */}
          {isAdmin && <AdminBroadcastPanel />}
        </div>
      </div>
    </AppLayout>
  );
}
