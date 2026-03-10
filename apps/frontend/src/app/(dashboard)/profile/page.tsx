'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, User, Lock, Shield, Globe, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguageStore, SUPPORTED_LOCALES, type Locale } from '@/store/languageStore';
import { AvatarCropDialog } from '@/components/features/AvatarCropDialog';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

function createProfileSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('validation.nameMin2')),
  });
}

function createPasswordSchema(t: (key: string) => string) {
  return z.object({
    currentPassword: z.string().min(1, t('validation.currentPasswordRequired')),
    newPassword: z.string().min(8, t('validation.passwordMin8')),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('validation.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });
}

type ProfileValues = z.infer<ReturnType<typeof createProfileSchema>>;
type PasswordValues = z.infer<ReturnType<typeof createPasswordSchema>>;

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLanguageStore();
  const [selectedTimezone, setSelectedTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Moscow', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney'];
    }
  }, []);

  // Initialize timezone from user data
  useEffect(() => {
    if ((user as any)?.timezone) {
      setSelectedTimezone((user as any).timezone);
    }
  }, [user]);

  const profileSchema = useMemo(() => createProfileSchema(t), [t]);
  const passwordSchema = useMemo(() => createPasswordSchema(t), [t]);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.name });
    }
  }, [user, profileForm]);

  const onUpdateProfile = async (data: ProfileValues) => {
    try {
      const res = await api.patch('/users/me', { name: data.name });
      setUser(res.data);
      toast.success(t('toasts.profileUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toasts.profileUpdateFailed'));
    }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error(t('profile.avatarTooLarge') || 'Image must be under 5 MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error(t('profile.avatarInvalidType') || 'Only JPEG, PNG, WebP and GIF images are allowed');
      return;
    }

    setAvatarFile(file);
    setShowCropDialog(true);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleAvatarCropped = async (blob: Blob) => {
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.jpg');
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(res.data);
      toast.success(t('toasts.avatarUploaded') || 'Avatar updated successfully');
      setShowCropDialog(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toasts.avatarUploadFailed') || 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onChangePassword = async (data: PasswordValues) => {
    try {
      await api.patch('/users/me/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success(t('toasts.passwordChanged'));
      passwordForm.reset();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toasts.passwordChangeFailed'));
    }
  };

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-3xl font-bold">{t('profile.title')}</h1>

      {/* Profile Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            {/* Clickable avatar — opens file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-14 w-14 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={t('profile.changeAvatar') || 'Change avatar'}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user?.name || ''}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || <User className="h-6 w-6" />}
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <div>
              <CardTitle>{user?.name || t('common.loading')}</CardTitle>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-1 flex items-center gap-1">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground capitalize">
                  {user?.role?.toLowerCase() || 'viewer'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('profile.displayName')}</Label>
              <Input id="name" {...profileForm.register('name')} />
              {profileForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {t('profile.avatarHint') || 'Click on the avatar above to upload a new photo (max 5 MB).'}
            </p>

            <Button type="submit" className="gap-2" disabled={profileForm.formState.isSubmitting}>
              <Save className="h-4 w-4" />
              {profileForm.formState.isSubmitting ? t('common.saving') : t('profile.saveChanges')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('profile.preferences')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language */}
          <div className="space-y-2">
            <Label>{t('profile.language')}</Label>
            <select
              value={locale}
              onChange={(e) => {
                const newLocale = e.target.value as Locale;
                setLocale(newLocale);
                toast.success(t('profile.preferencesSaved'));
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>{t('profile.timezone')}</Label>
            <select
              value={selectedTimezone}
              onChange={(e) => {
                setSelectedTimezone(e.target.value);
                api.patch('/users/me', { timezone: e.target.value }).catch(() => {});
                toast.success(t('profile.preferencesSaved'));
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label>{t('profile.theme')}</Label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="light">{t('profile.themeLight')}</option>
              <option value="dark">{t('profile.themeDark')}</option>
              <option value="system">{t('profile.themeSystem')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('profile.changePassword')}
          </CardTitle>
          <CardDescription>{t('profile.changePasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register('currentPassword')}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register('newPassword')}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('profile.confirmNewPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" variant="outline" className="gap-2" disabled={passwordForm.formState.isSubmitting}>
              <Lock className="h-4 w-4" />
              {passwordForm.formState.isSubmitting ? t('profile.changingPassword') : t('profile.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Avatar crop dialog */}
      <AvatarCropDialog
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageFile={avatarFile}
        onCropped={handleAvatarCropped}
        isUploading={isUploadingAvatar}
      />
    </div>
  );
}
