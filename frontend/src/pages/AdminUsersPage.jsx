import { request } from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { Button, ErrorMessage, LoadError, Loading, PageHeader } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'
import { useResource } from '../hooks/useResource.js'

function StatusBadge({ active }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-teal-50 text-teal-800' : 'bg-stone-200 text-stone-700'
      }`}
    >
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
    <tr>
      <td className="px-4 py-3">
        <span className="wrap-anywhere">{account.email}</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-stone-500 capitalize">{account.role}</span>
          <StatusBadge active={account.is_active} />
        </div>
        {error && (
          <div className="mt-2">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-stone-600 sm:table-cell">
        {new Date(account.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <span className="text-stone-500">You</span>
        ) : (
          <Button
            variant={account.is_active ? 'danger' : 'secondary'}
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
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  User
                </th>
                <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">
                  Joined
                </th>
                <th scope="col" className="px-4 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
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
