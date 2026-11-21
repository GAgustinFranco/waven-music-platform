import { queryOptions } from '@tanstack/react-query';
import { api, type Me } from './client';

/** Query key factories: every server-state key in the app is built here. */
export const meKeys = {
  all: ['me'] as const,
};

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
}

export function toApiError(error: unknown, response: Response): ApiError {
  const body = (typeof error === 'object' && error !== null ? error : {}) as ApiErrorBody;
  return new ApiError(
    body.statusCode ?? response.status,
    body.code ?? 'HTTP_ERROR',
    body.message ?? response.statusText,
  );
}

export const meQuery = () =>
  queryOptions({
    queryKey: meKeys.all,
    queryFn: async (): Promise<Me> => {
      const { data, error, response } = await api.GET('/me');
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });
