import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lightning, Spinner } from "@phosphor-icons/react";

export default function Login() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!authLoading && isAuthenticated) {
    const to = location.state?.from?.pathname || "/";
    return <Navigate to={to} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back");
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.status === 401
          ? "Invalid email or password."
          : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-sm bg-[#0033CC] flex items-center justify-center">
            <Lightning size={22} weight="fill" color="white" />
          </div>
          <div className="text-center">
            <div className="font-display font-black text-xl tracking-tight text-slate-900 leading-none">
              SOPRA PM
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-1">
              IT Control Room
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-sm p-6 space-y-4"
          data-testid="login-form"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-mono uppercase tracking-widest text-slate-500"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sopra.com"
              className="rounded-sm"
              data-testid="login-email"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-mono uppercase tracking-widest text-slate-500"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-sm"
              data-testid="login-password"
            />
          </div>

          {error && (
            <div
              className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-[#0033CC] hover:bg-[#0028A3]"
            data-testid="login-submit"
          >
            {submitting ? (
              <>
                <Spinner size={16} className="animate-spin mr-2" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Accounts are provisioned by an admin. Contact your PM lead if you
          don't have credentials.
        </p>
      </div>
    </div>
  );
}
