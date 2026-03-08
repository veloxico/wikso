'use client';

import { Suspense, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthFooter } from '@/components/features/AuthFooter';

const acceptInviteSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { setUser, setTokens } = useAuthStore();

  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{ email: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
  });

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    api
      .get(`/auth/invite/${token}`)
      .then((res) => {
        setInviteData(res.data);
        if (res.data.name) {
          setValue('name', res.data.name);
        }
      })
      .catch(() => {
        setInvalid(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, setValue]);

  const onSubmit = async (data: AcceptInviteValues) => {
    try {
      setError(null);
      const res = await api.post('/auth/accept-invite', {
        token,
        name: data.name,
        password: data.password,
      });

      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept invitation');
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invalid) {
    return (
      <div className="flex flex-col items-center gap-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please contact your administrator for
              a new invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
        <AuthFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Accept Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join Dokka as{' '}
            <span className="font-medium text-foreground">{inviteData?.email}</span>. Set up your
            account below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="John Doe" {...register('name')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={inviteData?.email || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Setting up...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-gray-500 w-full">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-black dark:text-white underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
      <AuthFooter />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="h-6 w-48 animate-pulse rounded bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        }
      >
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
