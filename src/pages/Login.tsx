import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const { session, loading } = useAuth();

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/8 blur-[100px]" />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display">Zyntra</span>
          </Link>
          <p className="text-sm text-muted-foreground">AI-Powered AMC Exam Preparation</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <Tabs defaultValue={defaultTab}>
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent value="login">
              <AuthForm mode="login" />
            </TabsContent>
            <TabsContent value="signup">
              <AuthForm mode="signup" />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        toast({ title: 'Account created!', description: 'Check your email to confirm your account.' });
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitting(true);
    try {
      const { error } = await (await import('@/lib/supabase')).supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Reset link sent!', description: 'Check your email for a password reset link.' });
      setShowForgot(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setForgotSubmitting(false);
    }
  };

  if (showForgot) {
    return (
      <CardContent className="pt-4">
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Forgot Password</h3>
            <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={forgotSubmitting}>
            {forgotSubmitting ? 'Sending...' : 'Send Reset Link'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgot(false)}>
            Back to login
          </Button>
        </form>
      </CardContent>
    );
  }

  return (
    <CardContent className="pt-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-email`}>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id={`${mode}-email`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-password`}>Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id={`${mode}-password`}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </Button>
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Forgot password?
          </button>
        )}
      </form>
    </CardContent>
  );
}
