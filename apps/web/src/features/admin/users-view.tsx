'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CreditCard, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAdminReady } from './admin-gate';
import {
  type AdminSubscription,
  adminSubscriptionsQuery,
  type AdminUser,
  adminUsersQuery,
  type Role,
  type SubscriptionStatus,
} from '@/lib/api/admin';
import { meQuery } from '@/lib/api/queries';
import { initialsOf } from '@/lib/format';
import { useChangeRole } from './mutations';
import {
  Badge,
  type Column,
  DataTable,
  formatDate,
  PageHeader,
  Pagination,
  SearchField,
  SelectField,
  useTableState,
} from './table';

const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'user', label: 'Users' },
  { value: 'admin', label: 'Admins' },
] as const;

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
] as const;

/** Users (US-18): search, filter by role and change roles. */
export function UsersView() {
  const ready = useAdminReady();
  const table = useTableState();
  const [role, setRole] = useState<Role | ''>('');
  const me = useQuery({ ...meQuery(), enabled: ready });
  const users = useQuery({
    ...adminUsersQuery({
      q: table.q,
      role: role || undefined,
      limit: table.limit,
      offset: table.offset,
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
  });
  const changeRole = useChangeRole();

  const columns: Column<AdminUser>[] = [
    {
      header: 'User',
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback>{initialsOf(user.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{user.displayName}</span>
            <span className="text-muted-foreground truncate text-xs">{user.email}</span>
          </div>
        </div>
      ),
    },
    { header: 'Joined', cell: (user) => formatDate(user.createdAt), optional: true },
    {
      header: 'Role',
      className: 'w-36',
      cell: (user) => {
        const self = user.id === me.data?.id;
        const busy = changeRole.isPending && changeRole.variables.id === user.id;
        return (
          <SelectField
            label={
              self
                ? `Role of ${user.displayName} (you cannot remove your own admin role)`
                : `Role of ${user.displayName}`
            }
            value={user.role}
            options={ROLE_OPTIONS}
            disabled={self || busy}
            onChange={(next) => changeRole.mutate({ id: user.id, role: next })}
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" description="Search users and change their role." />
      <div className="flex flex-wrap gap-3">
        <SearchField
          value={table.search}
          onChange={table.setSearch}
          label="Search by name or email"
        />
        <SelectField
          label="Filter by role"
          value={role}
          options={ROLE_FILTERS}
          onChange={(next) => {
            setRole(next);
            table.setOffset(0);
          }}
          className="w-40"
        />
      </div>
      <p className="text-muted-foreground text-sm">
        A role change reaches that user within 15 minutes, at their next token refresh.
      </p>
      <DataTable
        caption="Users"
        columns={columns}
        rows={users.data?.items}
        rowKey={(user) => user.id}
        loading={users.isFetching}
        stale={users.isPlaceholderData}
        error={users.isError}
        onRetry={() => void users.refetch()}
        empty={{ icon: Users, title: 'No users match', description: 'Try another search.' }}
      />
      <Pagination
        label="Users"
        total={users.data?.total}
        offset={table.offset}
        limit={table.limit}
        onChange={table.setOffset}
      />
    </div>
  );
}

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_TONE = {
  pending: 'warning',
  authorized: 'success',
  paused: 'neutral',
  cancelled: 'danger',
} as const satisfies Record<SubscriptionStatus, string>;

const STATUS_LABEL = Object.fromEntries(
  STATUS_FILTERS.filter((option) => option.value).map((option) => [option.value, option.label]),
) as Record<SubscriptionStatus, string>;

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);

/** Subscriptions (US-18), filterable by status. Payments arrive with billing (phase 9). */
export function SubscriptionsView() {
  const ready = useAdminReady();
  const table = useTableState();
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const subscriptions = useQuery({
    ...adminSubscriptionsQuery({
      q: table.q,
      status: status || undefined,
      limit: table.limit,
      offset: table.offset,
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
  });

  const columns: Column<AdminSubscription>[] = [
    {
      header: 'User',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.user.displayName}</span>
          <span className="text-muted-foreground truncate text-xs">{row.user.email}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
    },
    {
      header: 'Amount',
      cell: (row) => <span className="tabular-nums">{formatMoney(row.amount, row.currency)}</span>,
      optional: true,
    },
    {
      header: 'Mode',
      cell: (row) => <span className="capitalize">{row.mode}</span>,
      optional: true,
    },
    { header: 'Paid until', cell: (row) => formatDate(row.currentPeriodEnd), optional: true },
    { header: 'Created', cell: (row) => formatDate(row.createdAt), optional: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Subscriptions" description="Premium subscriptions and their status." />
      <div className="flex flex-wrap gap-3">
        <SearchField
          value={table.search}
          onChange={table.setSearch}
          label="Search by name or email"
        />
        <SelectField
          label="Filter by status"
          value={status}
          options={STATUS_FILTERS}
          onChange={(next) => {
            setStatus(next);
            table.setOffset(0);
          }}
          className="w-44"
        />
      </div>
      <DataTable
        caption="Subscriptions"
        columns={columns}
        rows={subscriptions.data?.items}
        rowKey={(row) => row.id}
        loading={subscriptions.isFetching}
        stale={subscriptions.isPlaceholderData}
        error={subscriptions.isError}
        onRetry={() => void subscriptions.refetch()}
        empty={{
          icon: CreditCard,
          title: 'No subscriptions yet',
          description: 'They appear here once users upgrade to Premium.',
        }}
      />
      <Pagination
        label="Subscriptions"
        total={subscriptions.data?.total}
        offset={table.offset}
        limit={table.limit}
        onChange={table.setOffset}
      />
    </div>
  );
}
