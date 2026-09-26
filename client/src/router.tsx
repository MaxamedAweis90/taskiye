import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Habits } from './pages/Habits';
import { Tasks } from './pages/Tasks';
import { Rank } from './pages/Rank';
import { NotFound } from './pages/NotFound';

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
        element: <Tasks />,
      },
      {
        path: 'rank',
        element: <Rank />,
      },
      {
        path: 'goals',
        element: <Navigate to="/rank" replace />,
      },
      {
        path: 'habit',
        element: <Navigate to="/habits" replace />,
      },
      {
        path: 'task',
        element: <Navigate to="/tasks" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
