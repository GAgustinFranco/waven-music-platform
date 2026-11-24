'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from '@/lib/api/client';
import { meKeys, toApiError } from '@/lib/api/queries';
import type { components } from '@/lib/api/schema';

type UpdateMe = components['schemas']['UpdateMeDto'];

/** `PATCH /me` (US-02). The answer is the whole profile, so it replaces the cache. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMe): Promise<Me> => {
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
