import { queryOptions } from '@tanstack/react-query';
import { api } from './client';
import { toApiError } from './queries';
import type { components } from './schema';

export type Plans = components['schemas']['PlansDto'];
export type PlanOffer = components['schemas']['PlanOfferDto'];
export type BillingStatus = components['schemas']['BillingStatusDto'];
export type Subscription = components['schemas']['SubscriptionDto'];
export type SubscriptionStatus = Subscription['status'];

export const billingKeys = {
  all: ['billing'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  status: () => [...billingKeys.all, 'subscription'] as const,
};

export const plansQuery = () =>
  queryOptions({
    queryKey: billingKeys.plans(),
    queryFn: async (): Promise<Plans> => {
      const { data, error, response } = await api.GET('/billing/plans');
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    staleTime: Infinity,
  });

export const billingStatusQuery = () =>
  queryOptions({
    queryKey: billingKeys.status(),
    queryFn: async (): Promise<BillingStatus> => {
      const { data, error, response } = await api.GET('/billing/subscription');
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });

export async function startCheckout(): Promise<string> {
  const { data, error, response } = await api.POST('/billing/checkout');
  if (!data) {
    throw toApiError(error, response);
  }
  return data.redirectUrl;
}

export async function cancelSubscription(): Promise<BillingStatus> {
  const { data, error, response } = await api.POST('/billing/subscription/cancel');
  if (!data) {
    throw toApiError(error, response);
  }
  return data;
}
