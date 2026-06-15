import { createFileRoute } from '@tanstack/react-router'
import StartupHome from '../components/startup-home'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <StartupHome analyticsSurface="startup_home" />
}
