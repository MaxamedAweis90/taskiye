import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { PlaceholderScreen } from './components/common/PlaceholderScreen';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Habits } from './pages/Habits';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'habits',
        element: <Habits />,
      },
      {
        path: 'tasks',
        element: (
          <PlaceholderScreen
            title="Daily Tasks Board"
            subtitle="Manage one-off items, toggle completion, and reorder daily routines."
          />
        ),
      },
      {
        path: 'goals',
        element: (
          <PlaceholderScreen
            title="Milestone Goals"
            subtitle="Track high-level objectives with strict weekly, yearly, and custom deadlines."
          />
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
