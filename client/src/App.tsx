import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthModal } from './components/auth/AuthModal';
import { SplashScreen } from './components/common/SplashScreen';
import { ToastNotification } from './components/common/ToastNotification';
import { TrashModal } from './components/trash/TrashModal';
import { RootErrorBoundary } from './components/common/RootErrorBoundary';

export const App: React.FC = () => {
  return (
    <RootErrorBoundary>
      <SplashScreen />
      <ToastNotification />
      <TrashModal />
      <RouterProvider router={router} />
      <AuthModal />
    </RootErrorBoundary>
  );
};

export default App;
