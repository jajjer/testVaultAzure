import { Link, Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/store/auth-store";

export function LoginPage() {
  const account = useAuthStore((s) => s.account);
  const signIn = useAuthStore((s) => s.signIn);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const authLoading = useAuthStore((s) => s.authLoading);

  if (account) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Test Vault — QA test management. Sign in with your Microsoft work
            account (Entra ID).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            disabled={authLoading}
            onClick={() => {
              clearError();
              void signIn();
            }}
          >
            Sign in with Microsoft
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">
            Need access?{" "}
            <Link
              to="/register"
              className="text-primary underline-offset-4 hover:underline"
            >
              Organization registration
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
