import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

import OverviewPage from '@/routes/Overview'
import KanbanPage from '@/routes/Kanban'
import AgentsPage from '@/routes/Agents'
import TeamPage from '@/routes/Team'
import SchedulesPage from '@/routes/Schedules'
import MemoriesPage from '@/routes/Memories'
import VaultPage from '@/routes/Vault'
import SecretsPage from '@/routes/Secrets'
import SkillsPage from '@/routes/Skills'
import McpPage from '@/routes/Mcp'
import MigratePage from '@/routes/Migrate'
import StatusPage from '@/routes/Status'
import SessionsPage from '@/routes/Sessions'
import UpdatesPage from '@/routes/Updates'
import NotFoundPage from '@/routes/NotFound'
import UsersPage from '@/routes/Users'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'kanban', element: <KanbanPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'schedules', element: <SchedulesPage /> },
      { path: 'memories', element: <MemoriesPage /> },
      { path: 'vault', element: <VaultPage /> },
      { path: 'secrets', element: <SecretsPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'mcp', element: <McpPage /> },
      { path: 'migrate', element: <MigratePage /> },
      { path: 'status', element: <StatusPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'updates', element: <UpdatesPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
