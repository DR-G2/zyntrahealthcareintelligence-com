import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Stethoscope, Search, Loader2, Activity, ChevronDown, ChevronUp, ClipboardList, FlaskConical, UserRound } from 'lucide-react';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { OSCEUnderConstruction } from '@/components/OSCEUnderConstruction';
import { useOSCEEnabled } from '@/hooks/useSiteSettings';

interface ClinicalStation {
  id: string;
  subject: string;
  scenario_title: string;
  scenario_data: any;
  session_id: string;
  created_at: string;
}

export default function QuestionsOSCE() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [stations, setStations] = useState<ClinicalStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('clinical_stations')
        .select('id, subject, scenario_title, scenario_data, session_id, created_at')
        .order('subject', { ascending: true });
      setStations((data as ClinicalStation[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const subjects = useMemo(() => {
    const set = new Set(stations.map(s => s.subject));
    return Array.from(set).sort();
  }, [stations]);

  const filtered = useMemo(() => {
    return stations.filter(s => {
      if (subjectFilter !== 'all' && s.subject !== subjectFilter) return false;
      if (search && !s.scenario_title.toLowerCase().includes(search.toLowerCase()) && !s.subject.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [stations, subjectFilter, search]);

  const getScenarioSummary = (data: any) => {
    if (!data || typeof data !== 'object') return null;
    const persona = data.patient_persona;
    const examCount = Array.isArray(data.examination_findings) ? data.examination_findings.length : 0;
    const investCount = Array.isArray(data.investigations) ? data.investigations.length : 0;
    const mgmtCount = Array.isArray(data.management_plan) ? data.management_plan.length : 0;
    return { persona, examCount, investCount, mgmtCount };
  };

  const { enabled: osceEnabled, loading: osceLoading } = useOSCEEnabled();

  return (
    <AppLayout>
      {!osceLoading && !osceEnabled ? (
        <OSCEUnderConstruction />
      ) : (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">OSCE Station Bank</h1>
          <p className="text-muted-foreground">Browse {stations.length} clinical stations across {subjects.length} specialties</p>
        </div>

        {!gate.canAccessOSCEBank ? (
          <UpgradePrompt feature="OSCE Station Bank" description="Upgrade to a paid plan to access the full OSCE station bank and scenario details." variant="card" />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stations..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects ({stations.length})</SelectItem>
                  {subjects.map(sub => (
                    <SelectItem key={sub} value={sub}>
                      {sub} ({stations.filter(s => s.subject === sub).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">
                    {stations.length === 0
                      ? 'No stations available yet — stations will appear here once generated via OSCE practice.'
                      : 'No stations match your filters.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((station) => {
                  const summary = getScenarioSummary(station.scenario_data);
                  const isExpanded = expandedId === station.id;
                  return (
                    <Card
                      key={station.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : station.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">{station.subject}</Badge>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <CardTitle className="text-base mt-2 flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                          <span className="line-clamp-2">{station.scenario_title || 'Untitled Station'}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {summary && (
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {summary.examCount > 0 && (
                              <span className="flex items-center gap-1">
                                <ClipboardList className="h-3 w-3" /> {summary.examCount} exam findings
                              </span>
                            )}
                            {summary.investCount > 0 && (
                              <span className="flex items-center gap-1">
                                <FlaskConical className="h-3 w-3" /> {summary.investCount} investigations
                              </span>
                            )}
                            {summary.mgmtCount > 0 && (
                              <span className="flex items-center gap-1">
                                <UserRound className="h-3 w-3" /> {summary.mgmtCount} mgmt steps
                              </span>
                            )}
                          </div>
                        )}

                        {isExpanded && summary?.persona && (
                          <div className="pt-2 border-t text-sm space-y-1">
                            {summary.persona.name && (
                              <p><span className="font-medium">Patient:</span> {summary.persona.name}, {summary.persona.age}</p>
                            )}
                            {summary.persona.presenting_complaint && (
                              <p><span className="font-medium">Complaint:</span> {summary.persona.presenting_complaint}</p>
                            )}
                            {summary.persona.background && (
                              <p className="text-muted-foreground text-xs line-clamp-3">{summary.persona.background}</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      )}
    </AppLayout>
  );
}
