"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginWithEmail, loginWithGoogle } from "@/lib/firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithEmail(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
        <Card className="w-full">
          <CardHeader title="Sign in" subtitle="Welcome back to Local App Sri Lanka" />
          {error && (
            <div className="mb-4 rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <form onSubmit={handleEmailLogin} className="space-y-4">
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
            />
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-muted-fg)]">OR</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            loading={loading}
          >
            Continue with Google
          </Button>
          <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
            No account?{" "}
            <Link
              href="/register"
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              Register
            </Link>
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
