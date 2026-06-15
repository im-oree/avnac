import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/files')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
