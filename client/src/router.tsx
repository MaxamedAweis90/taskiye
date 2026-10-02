import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { PageLoader } from './components/common/PageLoader';

/**
 * Lazy loads a component with automated chunk-load retry on redeployments
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed =
      typeof window !== 'undefined'
        ? JSON.parse(window.sessionStorage.getItem('taskiye_chunk_reload') || 'false')
        : false;

    try {
      const component = await factory();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('taskiye_chunk_reload', 'false');
      }
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed && typeof window !== 'undefined') {
        window.sessionStorage.setItem('taskiye_chunk_reload', 'true');
        window.location.reload();
        return { default: (() => null) as unknown as T };
      }
      throw error;
    }
  });
}

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Habits = lazyWithRetry(() => import('./pages/Habits'));
const Tasks = lazyWithRetry(() => import('./pages/Tasks'));
const Rank = lazyWithRetry(() => import('./pages/Rank'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

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
    element: (
      <Suspense fallback={<PageLoader message="Loading page..." />}>
        <NotFound />
      </Suspense>
    ),
  },
]);
