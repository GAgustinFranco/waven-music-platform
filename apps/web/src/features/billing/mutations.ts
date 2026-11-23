'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingKeys, cancelSubscription, startCheckout } from '@/lib/api/billing';
import { ApiError, meKeys } from '@/lib/api/queries';

function checkoutErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'SUBSCRIPTION_EXISTS':
        return 'You already have a subscription in progress. Check it on your profile.';
      case 'BILLING_UNAVAILABLE':
        return 'Payments aren’t available right now.';
      case 'PAYMENT_PROVIDER_ERROR':
        return 'Mercado Pago didn’t answer. Try again in a moment.';
    }
  }
  return 'Couldn’t start the checkout. Try again.';
}

/** `POST /billing/checkout`, then leaves the app for Mercado Pago's checkout. */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startCheckout,
    onSuccess: (redirectUrl) => {
      window.location.assign(redirectUrl);
    },
    onError: (error) => {
      toast.error(checkoutErrorMessage(error));
      void queryClient.invalidateQueries({ queryKey: billingKeys.status() });
    },
  });
}

/** `POST /billing/subscription/cancel`: the answer replaces the cached status. */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (status) => {
      queryClient.setQueryData(billingKeys.status(), status);
      void queryClient.invalidateQueries({ queryKey: meKeys.all });
    },
  });
}
