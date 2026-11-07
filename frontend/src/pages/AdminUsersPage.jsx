import { request } from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { Button, ErrorMessage, LoadError, Loading, PageHeader } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'
import { useResource } from '../hooks/useResource.js'

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${
        active ? 'bg-success/10 text-success' : 'bg-fill text-ink-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-ink-faint'}`}
      />
      {active ? 'Active' : 'Deactivated'}
    </span>
  )
}

function UserRow({ account, isSelf, onUpdated }) {
  const { run, pending, error } = useAction()

  function setActive(isActive) {
    if (!isActive && !window.confirm(`Deactivate ${account.email}? They'll be signed out.`)) return
    run(async () => {
      onUpdated(
        await request(`/admin/users/${account.id}`, {
          method: 'PATCH',
          json: { is_active: isActive },
        }),
      )
    })
  }

  return (
    <tr className="transition-colors hover:bg-fill/40">
      <td className="py-3.5 pr-4 pl-5">
        <span className="font-medium wrap-anywhere">{account.email}</span>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-footnote text-ink-muted capitalize">{account.role}</span>
          <StatusBadge active={account.is_active} />
        </div>
        {error && (
          <div className="mt-2">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </td>
      <td className="hidden px-4 py-3.5 text-subhead whitespace-nowrap text-ink-muted tabular-nums sm:table-cell">
        {new Date(account.created_at).toLocaleDateString()}
      </td>
      <td className="py-3.5 pr-5 pl-4 text-right">
        {isSelf ? (
          <span className="rounded-full bg-fill px-2.5 py-1 text-footnote font-medium text-ink-muted">
            You
          </span>
        ) : (
          <Button
            variant={account.is_active ? 'danger' : 'tinted'}
            size="sm"
            disabled={pending}
            onClick={() => setActive(!account.is_active)}
          >
            {account.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        )}
      </td>
    </tr>
  )
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const { data: users, error, reload, setData } = useResource('/admin/users')

  function handleUpdated(updated) {
    setData((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Deactivated users can't log in, and are signed out." />
      {error && <LoadError error={error} onRetry={reload} />}
      {!error && users === undefined && <Loading />}
      {users && (
        <div className="animate-rise overflow-x-auto rounded-2xl bg-surface shadow-card dark:shadow-none">
          <table className="w-full text-left text-subhead">
            <thead className="border-b border-line text-footnote text-ink-muted">
              <tr>
                <th scope="col" className="py-2.5 pr-4 pl-5 font-medium">
                  User
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  Joined
                </th>
                <th scope="col" className="py-2.5 pr-5 pl-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((account) => (
                <UserRow
                  key={account.id}
                  account={account}
                  isSelf={account.id === user.id}
                  onUpdated={handleUpdated}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
