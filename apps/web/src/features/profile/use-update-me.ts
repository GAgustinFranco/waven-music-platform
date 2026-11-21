'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from '@/lib/api/client';
import { meKeys, toApiError } from '@/lib/api/queries';

/** `PATCH /me` (US-02). The answer is the whole profile, so it replaces the cache. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { displayName: string }): Promise<Me> => {
      const { data, error, response } = await api.PATCH('/me', { body });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    onSuccess: (me) => {
      queryClient.setQueryData(meKeys.all, me);
    },
  });
}
