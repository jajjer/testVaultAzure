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

export function RegisterPage() {
  const account = useAuthStore((s) => s.account);

  if (account) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organization access</CardTitle>
          <CardDescription>
            Accounts are provisioned through Microsoft Entra ID. New users
            receive the Tester role by default; an administrator can change
            roles in the database or admin tooling.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            If you need an account, contact your Test Vault administrator or IT
            team. Self-service email/password registration is not available in
            the Azure deployment.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" variant="secondary">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
