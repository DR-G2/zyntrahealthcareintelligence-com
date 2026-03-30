import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Activity, Users, Zap, BarChart3, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface AggregateData {
  mcq?: {
    total_attempts?: number;
    overall_accuracy?: number;
    avg_time_seconds?: number;
    category_pass_rates?: { category: string; accuracy: number; sample: number }[];
  };
  behavior?: {
    archetype_distribution?: Record<string, number>;
    common_traps?: { trap: string; count: number; percent: number }[];
  };
  osce?: {
    total_stations?: number;
    avg_score?: number;
  };
  generated_at?: string;
}

const LEARNING_NODES = [
  { label: 'Clinical Reasoning', icon: Brain, color: 'from-blue-500/20 to-cyan-500/20', glow: 'shadow-blue-500/20', delay: 0 },
  { label: 'Difficulty Mapping', icon: BarChart3, color: 'from-purple-500/20 to-pink-500/20', glow: 'shadow-purple-500/20', delay: 0.2 },
  { label: 'Behavioral Analytics', icon: Activity, color: 'from-amber-500/20 to-orange-500/20', glow: 'shadow-amber-500/20', delay: 0.4 },
  { label: 'Timing Patterns', icon: Clock, color: 'from-emerald-500/20 to-teal-500/20', glow: 'shadow-emerald-500/20', delay: 0.6 },
];

export default function ZyntraAICore() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from('ai_training_context').select('aggregate_data, candidate_count, updated_at').limit(1).maybeSingle();
      if (row) {
        setData(row.aggregate_data as unknown as AggregateData);
        setCandidateCount(row.candidate_count ?? 0);
        setUpdatedAt(row.updated_at);
      }
      setLoading(false);
    })();
  }, []);

  const intelligenceScore = useMemo(() => {
    if (!data?.mcq) return 0;
    const attempts = data.mcq.total_attempts ?? 0;
    return Math.min(98, Math.round(20 * Math.log10(Math.max(attempts, 1)) + 10));
  }, [data]);

  const totalInteractions = (data?.mcq?.total_attempts ?? 0) + (data?.osce?.total_stations ?? 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display">Zyntra AI Core</h1>
              <p className="text-sm text-muted-foreground">The neural brain powering your learning experience</p>
            </div>
          </div>
        </motion.div>

        {/* Intelligence Growth Meter */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className="overflow-hidden border-primary/10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display">
                <Zap className="h-5 w-5 text-primary" />
                AI Intelligence Growth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold font-display text-primary">{loading ? '—' : `${intelligenceScore}%`}</div>
                  <p className="text-xs text-muted-foreground mt-1">System intelligence level</p>
                </div>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  {loading ? '...' : `${totalInteractions.toLocaleString()} interactions processed`}
                </Badge>
              </div>
              <Progress value={loading ? 0 : intelligenceScore} className="h-3" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <div className="text-lg font-bold">{loading ? '—' : (data?.mcq?.overall_accuracy ?? 0)}%</div>
                  <div className="text-[11px] text-muted-foreground">Avg Accuracy Tracked</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{loading ? '—' : candidateCount.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Candidates Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{loading ? '—' : (data?.mcq?.category_pass_rates?.length ?? 0)}</div>
                  <div className="text-[11px] text-muted-foreground">Categories Mapped</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Learning Nodes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <h2 className="text-lg font-display font-semibold mb-4">Active Learning Nodes</h2>
          <div className="grid grid-cols-2 gap-4">
            {LEARNING_NODES.map((node) => (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: node.delay + 0.3 }}
              >
                <Card className={`relative overflow-hidden border-primary/10 hover:shadow-lg ${node.glow} transition-shadow duration-300`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${node.color} pointer-events-none`} />
                  <CardContent className="flex items-center gap-4 p-5">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: node.delay }}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm"
                    >
                      <node.icon className="h-6 w-6 text-primary" />
                    </motion.div>
                    <div>
                      <div className="font-semibold text-sm">{node.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {node.label === 'Clinical Reasoning' && `Analyzing ${(data?.mcq?.total_attempts ?? 0).toLocaleString()} clinical decisions`}
                        {node.label === 'Difficulty Mapping' && `${(data?.mcq?.category_pass_rates?.length ?? 0)} categories calibrated`}
                        {node.label === 'Behavioral Analytics' && `${Object.keys(data?.behavior?.archetype_distribution ?? {}).length} archetypes identified`}
                        {node.label === 'Timing Patterns' && `Avg response: ${data?.mcq?.avg_time_seconds ?? 0}s tracked`}
                      </div>
                    </div>
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: node.delay }}
                      className="ml-auto h-2 w-2 rounded-full bg-emerald-500"
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ====== DATA PORTABILITY SECTION ====== */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <h2 className="text-lg font-display font-semibold mb-4">Data Portability</h2>
          <div className="grid md:grid-cols-2 gap-4">

            {/* EXPORT CARD */}
            <Card className="border-primary/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-display">
                  <Download className="h-4 w-4 text-emerald-500" />
                  Download Your Learning Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Range selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Date Range</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['full', '7d', 'custom'] as ExportRange[]).map(r => (
                      <Button
                        key={r}
                        size="sm"
                        variant={exportRange === r ? 'default' : 'outline'}
                        onClick={() => setExportRange(r)}
                        className="text-xs"
                      >
                        {r === 'full' ? 'Full Dataset' : r === '7d' ? 'Last 7 Days' : 'Custom Range'}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom date pickers */}
                <AnimatePresence>
                  {exportRange === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex gap-2"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("text-xs flex-1 justify-start", !customStart && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {customStart ? format(customStart, 'PP') : 'Start'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("text-xs flex-1 justify-start", !customEnd && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {customEnd ? format(customEnd, 'PP') : 'End'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Format selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Format</label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={exportFormat === 'json' ? 'default' : 'outline'}
                      onClick={() => setExportFormat('json')}
                      className="text-xs gap-1"
                    >
                      <FileJson className="h-3 w-3" /> JSON
                    </Button>
                    <Button
                      size="sm"
                      variant={exportFormat === 'csv' ? 'default' : 'outline'}
                      onClick={() => setExportFormat('csv')}
                      className="text-xs gap-1"
                    >
                      <FileSpreadsheet className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                  {exportFormat === 'csv' && (
                    <p className="text-[10px] text-muted-foreground mt-1">CSV exports question history only (compatible with Excel, pandas)</p>
                  )}
                </div>

                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full gap-2"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exporting ? 'Exporting…' : 'Export Learning Data'}
                </Button>
              </CardContent>
            </Card>

            {/* IMPORT CARD */}
            <Card className="border-primary/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent pointer-events-none" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-display">
                  <Upload className="h-4 w-4 text-blue-500" />
                  Upload Training Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drag & drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                    dragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/20 hover:border-primary/40",
                    importFile && "border-emerald-500/40 bg-emerald-500/5"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileJson className="h-5 w-5 text-emerald-500" />
                      <span className="text-sm font-medium truncate max-w-[180px]">{importFile.name}</span>
                      <Badge variant="outline" className="text-[10px]">{(importFile.size / 1024).toFixed(1)} KB</Badge>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">Drop .json file here or click to browse</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Schema v1.0 format required</p>
                    </>
                  )}
                </div>

                {/* Merge mode */}
                {importFile && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <label className="text-xs font-medium text-muted-foreground block">Merge Strategy</label>
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { value: 'merge' as MergeMode, label: 'Merge', desc: 'Combine with existing' },
                        { value: 'replace' as MergeMode, label: 'Replace', desc: 'Overwrite current data' },
                        { value: 'simulate' as MergeMode, label: 'Simulate', desc: 'Preview without changes' },
                      ]).map(m => (
                        <Button
                          key={m.value}
                          size="sm"
                          variant={mergeMode === m.value ? 'default' : 'outline'}
                          onClick={() => setMergeMode(m.value)}
                          className="text-xs flex-1"
                        >
                          {m.label}
                        </Button>
                      ))}
                    </div>

                    <Button
                      onClick={() => processImport(mergeMode === 'simulate')}
                      disabled={importing}
                      className="w-full gap-2"
                      variant={mergeMode === 'replace' ? 'destructive' : 'default'}
                    >
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {importing ? 'Processing…' : mergeMode === 'simulate' ? 'Run Simulation' : mergeMode === 'replace' ? 'Replace & Import' : 'Merge & Import'}
                    </Button>
                  </motion.div>
                )}

                {/* Simulation Result */}
                {simulationResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Simulation Preview
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      {Object.entries(simulationResult.records_to_process || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-mono">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                    {simulationResult.warnings?.length > 0 && (
                      <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 mt-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{simulationResult.warnings[0]}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => { setMergeMode('merge'); processImport(false); }}
                    >
                      Apply Import
                    </Button>
                  </motion.div>
                )}

                {/* Import Result */}
                {importResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("rounded-xl border p-4 space-y-2", importResult.error ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5")}
                  >
                    {importResult.error ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {importResult.error}
                        </div>
                        {importResult.details && (
                          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                            {importResult.details.map((d: string, i: number) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          {importResult.message}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Version: <span className="font-mono">{importResult.version}</span>
                        </div>
                        {importResult.results && (
                          <div className="text-xs space-y-1 text-muted-foreground">
                            {Object.entries(importResult.results).map(([key, val]) => (
                              <div key={key} className="flex justify-between">
                                <span>{key.replace(/_/g, ' ')}</span>
                                <Badge variant="outline" className="text-[10px]">{String(val)}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Version History */}
        {history.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-display font-semibold">Version History</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-xs">
                {showHistory ? 'Hide' : `Show (${history.length})`}
              </Button>
            </div>
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="border-primary/10">
                    <CardContent className="p-4">
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {history.map((h) => (
                          <div key={h.id} className="flex items-center justify-between p-2 rounded-lg border bg-card/50 text-xs">
                            <div className="flex items-center gap-2">
                              {h.action_type === 'export' ? (
                                <Download className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Upload className="h-3 w-3 text-blue-500" />
                              )}
                              <span className="font-medium capitalize">{h.action_type}</span>
                              {h.merge_mode && <Badge variant="outline" className="text-[9px]">{h.merge_mode}</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span className="font-mono">v{h.version}</span>
                              <span>{new Date(h.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Community Learning */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <Card className="border-primary/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display">
                <Users className="h-5 w-5 text-primary" />
                Community Learning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Zyntra AI learns from every interaction across the platform, continuously improving question recommendations, difficulty calibration, and behavioral insights for all candidates.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card/50 p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{loading ? '—' : totalInteractions.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Interactions Learned From</div>
                </div>
                <div className="rounded-xl border bg-card/50 p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{loading ? '—' : (data?.behavior?.common_traps?.length ?? 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Behavioral Traps Identified</div>
                </div>
              </div>
              {updatedAt && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Last model update: {new Date(updatedAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
