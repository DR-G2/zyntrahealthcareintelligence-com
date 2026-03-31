import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, FileJson, FileSpreadsheet, CalendarIcon, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ExportRange = 'full' | '7d' | 'custom';
type MergeMode = 'replace' | 'merge';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strip large arrays that the import function ignores anyway */
function trimPayload(data: any) {
  if (!data || typeof data !== 'object') return data;
  const { question_history, osce_history, performance_trends, mistake_patterns, ...rest } = data;
  return {
    ...rest,
    question_history: Array.isArray(question_history) ? question_history.slice(0, 5) : [],
    osce_history: [],
    _trimmed: {
      question_history_count: Array.isArray(question_history) ? question_history.length : 0,
      osce_history_count: Array.isArray(osce_history) ? osce_history.length : 0,
    },
  };
}

export function DataPortabilityTab() {
  const [targetUserId, setTargetUserId] = useState('');
  const [exportRange, setExportRange] = useState<ExportRange>('full');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [exporting, setExporting] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>('merge');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetValid = targetUserId.trim() === '' || UUID_RE.test(targetUserId.trim());

  const handleExport = useCallback(async () => {
    if (!targetValid) { toast.error('Invalid User ID format'); return; }
    setExporting(true);
    try {
      const payload: any = { format: exportFormat, range: exportRange };
      if (targetUserId.trim()) payload.target_user_id = targetUserId.trim();
      if (exportRange === 'custom') {
        if (!customStart || !customEnd) { toast.error('Select both start and end dates'); setExporting(false); return; }
        payload.start_date = customStart.toISOString();
        payload.end_date = customEnd.toISOString();
      }

      const { data: result, error } = await supabase.functions.invoke('export-learning-data', { body: payload });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const isCSV = exportFormat === 'csv';
      const blob = new Blob([isCSV ? result : JSON.stringify(result, null, 2)], { type: isCSV ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const uid = (targetUserId.trim() || 'admin').substring(0, 8);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `zyntra_ai_core_${uid}_${ts}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Learning data exported successfully');
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exportFormat, exportRange, customStart, customEnd, targetUserId, targetValid]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      setImportFile(file);
      setImportResult(null);
      setSimulationResult(null);
    } else {
      toast.error('Only .json files are accepted');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImportFile(file); setImportResult(null); setSimulationResult(null); }
  }, []);

  const processImport = useCallback(async (simulate: boolean) => {
    if (!importFile) return;
    if (!targetValid) { toast.error('Invalid User ID format'); return; }
    setImporting(true);
    setImportResult(null);
    setSimulationResult(null);

    try {
      const text = await importFile.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { toast.error('Invalid JSON file'); setImporting(false); return; }

      // Trim large arrays to reduce payload
      const trimmed = simulate ? parsed : trimPayload(parsed);

      const body: any = { data: trimmed, merge_mode: simulate ? 'merge' : mergeMode, simulate };
      if (targetUserId.trim()) body.target_user_id = targetUserId.trim();

      const { data: result, error } = await supabase.functions.invoke('import-learning-data', { body });

      // Handle invoke-level errors
      if (error) throw error;

      // Handle structured error responses
      if (result?.success === false) {
        const errMsg = result.error || 'Import failed';
        const stepInfo = result.step ? ` (step: ${result.step})` : '';
        toast.error(`${errMsg}${stepInfo}`);
        setImportResult({ error: errMsg, step: result.step, details: result.details });
        return;
      }

      if (simulate) {
        setSimulationResult(result);
        toast.success('Simulation complete — review before applying');
      } else {
        setImportResult(result);
        toast.success(result.message || 'Import complete');
      }
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
      setImportResult({ error: e.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }, [importFile, mergeMode, targetUserId, targetValid]);

  return (
    <div className="space-y-6">
      {/* Target User */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Target User</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="User ID (UUID — leave empty for your own data)"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className={cn("font-mono text-sm", !targetValid && "border-destructive")}
          />
          {!targetValid && <p className="text-xs text-destructive mt-1">Must be a valid UUID</p>}
          <p className="text-xs text-muted-foreground mt-2">Enter a user's UUID to export/import their learning data</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* EXPORT */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-emerald-500" />
              Export Learning Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Date Range</label>
              <div className="flex gap-2 flex-wrap">
                {(['full', '7d', 'custom'] as ExportRange[]).map(r => (
                  <Button key={r} size="sm" variant={exportRange === r ? 'default' : 'outline'} onClick={() => setExportRange(r)} className="text-xs">
                    {r === 'full' ? 'Full Dataset' : r === '7d' ? 'Last 7 Days' : 'Custom Range'}
                  </Button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {exportRange === 'custom' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("text-xs flex-1 justify-start", !customStart && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {customStart ? format(customStart, 'PP') : 'Start'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
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
                      <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Format</label>
              <div className="flex gap-2">
                <Button size="sm" variant={exportFormat === 'json' ? 'default' : 'outline'} onClick={() => setExportFormat('json')} className="text-xs gap-1">
                  <FileJson className="h-3 w-3" /> JSON
                </Button>
                <Button size="sm" variant={exportFormat === 'csv' ? 'default' : 'outline'} onClick={() => setExportFormat('csv')} className="text-xs gap-1">
                  <FileSpreadsheet className="h-3 w-3" /> CSV
                </Button>
              </div>
            </div>

            <Button onClick={handleExport} disabled={exporting || !targetValid} className="w-full gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Exporting…' : 'Export Learning Data'}
            </Button>
          </CardContent>
        </Card>

        {/* IMPORT */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-blue-500" />
              Import Training Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
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
                </>
              )}
            </div>

            {importFile && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground block">Merge Strategy</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { value: 'merge' as MergeMode, label: 'Merge' },
                    { value: 'replace' as MergeMode, label: 'Replace' },
                  ]).map(m => (
                    <Button key={m.value} size="sm" variant={mergeMode === m.value ? 'default' : 'outline'} onClick={() => setMergeMode(m.value)} className="text-xs flex-1">
                      {m.label}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => processImport(true)}
                    disabled={importing || !targetValid}
                    variant="outline"
                    className="flex-1 gap-2 text-xs"
                  >
                    {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Simulate
                  </Button>
                  <Button
                    onClick={() => processImport(false)}
                    disabled={importing || !targetValid}
                    className="flex-1 gap-2 text-xs"
                    variant={mergeMode === 'replace' ? 'destructive' : 'default'}
                  >
                    {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {mergeMode === 'replace' ? 'Replace & Import' : 'Merge & Import'}
                  </Button>
                </div>
              </motion.div>
            )}

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
              </motion.div>
            )}

            {importResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={cn("rounded-xl border p-4 space-y-2", importResult.error ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5")}
              >
                {importResult.error ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" /> {importResult.error}
                    </div>
                    {importResult.step && (
                      <p className="text-xs text-muted-foreground">Failed at step: <code className="bg-muted px-1 rounded">{importResult.step}</code></p>
                    )}
                    {importResult.details && (
                      <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                        {importResult.details.map((d: string, i: number) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> {importResult.message}
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
    </div>
  );
}
