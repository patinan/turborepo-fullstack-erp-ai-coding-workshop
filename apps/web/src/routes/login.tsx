import type { LoginInput, Role } from '@erp/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeRedirect, useSession } from '@/lib/auth';
import { errorMessage, fieldIssues, toApiError } from '@/lib/errors';
import { orpc } from '@/lib/orpc';
import { ROLE_LABELS } from '@/lib/roles';

// Created by packages/database/src/fixture.ts.
const demoAccounts: { username: string; role: Role }[] = [
  { username: 'admin01', role: 'ADMIN' },
  { username: 'buyer01', role: 'PURCHASING' },
  { username: 'staff_b01', role: 'STORE_STAFF' },
  { username: 'staff_b02', role: 'STORE_STAFF' },
  { username: 'manager01', role: 'MANAGER' },
];
const DEMO_PASSWORD = 'password';

type Field = keyof LoginInput;
const FIELDS: Field[] = ['username', 'password'];

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const queryClient = useQueryClient();
  const session = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation(
    orpc.auth.login.mutationOptions({
      // Storing the session re-renders this page, which then redirects below.
      onSuccess: (user) => queryClient.setQueryData(orpc.auth.me.queryKey(), { user }),
    }),
  );

  if (session.data?.user) return <Navigate to={redirectTo} replace />;

  const error = login.error ? toApiError(login.error) : null;
  // An error about a field goes beside that field, any other error above the button.
  const invalidFields = error ? fieldIssues(error) : {};
  const fieldError = (field: Field) =>
    error && field in invalidFields ? errorMessage(error) : undefined;
  const formError = error && !FIELDS.some((field) => field in invalidFields) ? error : null;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">ERP Workshop</CardTitle>
          <CardDescription>เข้าสู่ระบบเพื่อใช้งาน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              // The API trims, lower-cases and validates the input (the contract's LoginInputSchema).
              login.mutate({ username, password });
            }}
          >
            <TextField
              id="username"
              label="ชื่อผู้ใช้"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={setUsername}
              error={fieldError('username')}
            />
            <TextField
              id="password"
              label="รหัสผ่าน"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              error={fieldError('password')}
            />
            {formError && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{errorMessage(formError)}</p>
                {formError.kind === 'retry' && login.variables && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => login.mutate(login.variables)}
                  >
                    ลองอีกครั้ง
                  </Button>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>

          <div className="space-y-2 rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium">บัญชีทดลอง (รหัสผ่าน: {DEMO_PASSWORD})</p>
            {demoAccounts.map((account) => (
              <button
                key={account.username}
                type="button"
                className="flex w-full justify-between text-left text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setUsername(account.username);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                <span>{account.username}</span>
                <span>{ROLE_LABELS[account.role]}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  id,
  label,
  error,
  onChange,
  ...input
}: {
  id: Field;
  label: string;
  error: string | undefined;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, 'id' | 'onChange'>) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        {...input}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
