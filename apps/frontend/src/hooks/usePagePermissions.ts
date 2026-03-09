import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePage } from '@/hooks/usePages';
import { useSpace, useSpaceMembers } from '@/hooks/useSpaces';
import type { SpacePermission } from '@/types';

interface PagePermissions {
  canEdit: boolean;
  canView: boolean;
  isLoading: boolean;
}

export function usePagePermissions(slug: string, pageId: string): PagePermissions {
  const user = useAuthStore((s) => s.user);
  const { data: page, isLoading: pageLoading } = usePage(slug, pageId);
  const { data: space, isLoading: spaceLoading } = useSpace(slug);
  const { data: members, isLoading: membersLoading } = useSpaceMembers(slug);

  const isLoading = pageLoading || spaceLoading || membersLoading;

  const permissions = useMemo(() => {
    if (!user || !page || !space) {
      return { canEdit: false, canView: false };
    }

    // Global admin can do everything
    if (user.role === 'ADMIN') {
      return { canEdit: true, canView: true };
    }

    // Page author can always edit
    if (page.authorId === user.id) {
      return { canEdit: true, canView: true };
    }

    // Space owner can always edit
    if (space.ownerId === user.id) {
      return { canEdit: true, canView: true };
    }

    // Check space membership
    const membership = (members as SpacePermission[] | undefined)?.find(
      (m) => m.userId === user.id
    );

    if (space.type === 'PUBLIC') {
      // Public space: anyone can view
      // Editors and admins (by membership) can edit
      const canEdit = membership
        ? membership.role === 'ADMIN' || membership.role === 'EDITOR'
        : false;
      return { canEdit, canView: true };
    }

    // Private/Personal space: must be a member
    if (!membership) {
      return { canEdit: false, canView: false };
    }

    const canEdit = membership.role === 'ADMIN' || membership.role === 'EDITOR';
    return { canEdit, canView: true };
  }, [user, page, space, members]);

  return { ...permissions, isLoading };
}
