"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AuthShell } from "@/components/layout/AuthShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { registerWithEmail, loginWithGoogle, sendEmailVerificationLink } from "@/lib/firebase/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await registerWithEmail(email, password, displayName);
      await sendEmailVerificationLink().catch(() => {});
      sessionStorage.setItem("la_session", String(Date.now()));
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <AuthShell>
        <Card className="w-full">
          <CardHeader title="Create account" subtitle="Join Local App Sri Lanka" />
          {error && (
            <div className="mb-4 rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-muted-fg)]">OR</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} loading={loading}>
            Continue with Google
          </Button>
          <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </Card>
      </AuthShell>
    </PublicLayout>
  );
}
