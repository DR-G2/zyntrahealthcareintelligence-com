import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  Wand2, CheckCircle, XCircle, Clock, Database, Server, Monitor, Shield,
  Loader2, History, FileCode, ArrowRight, Copy, Check,
} from "lucide-react";

interface FeaturePlan {
  summary?: string;
  affected_modules?: string[];
  steps?: { step_number: number; title: string; description: string; type: string }[];
  security_notes?: string;
}

interface GeneratedCode {
  database_changes?: string | null;
  api_changes?: string | null;
  ui_changes?: string | null;
}

interface FeatureRequest {
  id: string;
  prompt: string;
  plan: FeaturePlan;
  generated_code: GeneratedCode;
  status: string;
  created_by: string;
  created_at: string;
}

const STEP_ICONS: Record<string, React.ElementType> = {
  database: Database,
  api: Server,
  ui: Monitor,
  config: Shield,
};

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { variant: "secondary", icon: Clock },
  approved: { variant: "default", icon: CheckCircle },
  rejected: { variant: "destructive", icon: XCircle },
};

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <FileCode className="h-4 w-4" /> {label}
        </h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <ScrollArea className="max-h-96">
        <pre className="rounded-lg bg-muted/50 border p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {code}
        </pre>
      </ScrollArea>
    </div>
  );
}

export default function AIFeatureBuilder() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<FeatureRequest | null>(null);
  const [history, setHistory] = useState<FeatureRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [approving, setApproving] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-feature-builder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "history" }),
        }
      );
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast({ title: "Prompt too short", description: "Please describe the feature in at least 10 characters.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setCurrentResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-feature-builder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "generate", prompt: prompt.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      const data: FeatureRequest = await res.json();
      setCurrentResult(data);
      toast({ title: "Plan generated", description: "Review the implementation plan below." });
      fetchHistory();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setApproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-feature-builder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action, request_id: requestId }),
        }
      );
      if (!res.ok) throw new Error(`Failed to ${action}`);
      toast({ title: action === "approve" ? "Approved" : "Rejected", description: `Feature request ${action}d successfully.` });
      if (currentResult?.id === requestId) {
        setCurrentResult({ ...currentResult, status: action === "approve" ? "approved" : "rejected" });
      }
      fetchHistory();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const renderPlan = (request: FeatureRequest) => {
    const plan = request.plan;
    const code = request.generated_code;

    return (
      <div className="space-y-6">
        {/* Status & Summary */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <p className="text-sm text-muted-foreground">Prompt</p>
            <p className="font-medium">{request.prompt}</p>
            {plan.summary && <p className="text-sm text-muted-foreground mt-2">{plan.summary}</p>}
          </div>
          <Badge variant={STATUS_CONFIG[request.status]?.variant || "outline"}>
            {request.status}
          </Badge>
        </div>

        {/* Affected Modules */}
        {plan.affected_modules && plan.affected_modules.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Affected Modules</h4>
            <div className="flex flex-wrap gap-1.5">
              {plan.affected_modules.map((m, i) => (
                <Badge key={i} variant="outline" className="text-xs font-mono">{m}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {plan.steps && plan.steps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Implementation Steps</h4>
            <div className="space-y-3">
              {plan.steps.map((step) => {
                const StepIcon = STEP_ICONS[step.type] || ArrowRight;
                return (
                  <div key={step.step_number} className="flex gap-3 items-start p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary shrink-0">
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Step {step.step_number}</span>
                        <Badge variant="outline" className="text-[10px]">{step.type}</Badge>
                      </div>
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Security Notes */}
        {plan.security_notes && (
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <Shield className="h-4 w-4" /> Security Notes
            </h4>
            <p className="text-xs text-muted-foreground mt-1">{plan.security_notes}</p>
          </div>
        )}

        {/* Generated Code */}
        {(code?.database_changes || code?.api_changes || code?.ui_changes) && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground">Generated Code Patches</h4>
            {code.database_changes && <CodeBlock code={code.database_changes} label="Database Migration" />}
            {code.api_changes && <CodeBlock code={code.api_changes} label="API / Edge Function" />}
            {code.ui_changes && <CodeBlock code={code.ui_changes} label="UI Components" />}
          </div>
        )}

        {/* Actions */}
        {request.status === "pending" && (
          <div className="flex gap-3 pt-2">
            <Button onClick={() => handleAction(request.id, "approve")} disabled={approving} className="gap-2">
              <CheckCircle className="h-4 w-4" /> Approve Changes
            </Button>
            <Button variant="destructive" onClick={() => handleAction(request.id, "reject")} disabled={approving} className="gap-2">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold font-display">AI Feature Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Describe a feature in natural language and get a structured implementation plan with code patches.
          </p>
        </div>

        <Tabs defaultValue="builder" className="space-y-4">
          <TabsList>
            <TabsTrigger value="builder" className="gap-2"><Wand2 className="h-4 w-4" /> Builder</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> History</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4">
            {/* Prompt Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Feature Request</CardTitle>
                <CardDescription>Describe the feature you want to build. Be specific about requirements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder='e.g. "Add a user banning system with admin controls, including a ban reason field, automatic session termination, and an unban option."'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                  disabled={generating}
                />
                <Button onClick={handleGenerate} disabled={generating || prompt.trim().length < 10} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {generating ? "Generating Plan..." : "Generate Implementation Plan"}
                </Button>
              </CardContent>
            </Card>

            {/* Result */}
            {currentResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Implementation Plan</CardTitle>
                </CardHeader>
                <CardContent>{renderPlan(currentResult)}</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" /> Request History
                </CardTitle>
                <CardDescription>{history.length} feature request(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No feature requests yet.</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((req) => (
                      <details key={req.id} className="group border rounded-lg">
                        <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-sm font-medium truncate">{req.prompt}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(req.created_at).toLocaleString()} • {req.created_by}
                            </p>
                          </div>
                          <Badge variant={STATUS_CONFIG[req.status]?.variant || "outline"}>
                            {req.status}
                          </Badge>
                        </summary>
                        <div className="p-4 pt-0 border-t">{renderPlan(req)}</div>
                      </details>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
