import { SearchIcon } from '../components/icons.jsx'
import { EmptyState, LinkButton } from '../components/ui.jsx'

export default function NotFoundPage() {
  return (
    <EmptyState
      level={1}
      icon={<SearchIcon className="size-8" />}
      title="Page not found"
      action={
        <LinkButton variant="secondary" to="/">
          Back to the home page
        </LinkButton>
      }
    >
      There's nothing at this address.
    </EmptyState>
  )
}
