import { Link } from 'react-router-dom'

import { PageHeader } from '../components/ui.jsx'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Link to="/" className="text-sm font-medium underline underline-offset-4">
        Back to the home page
      </Link>
    </>
  )
}
