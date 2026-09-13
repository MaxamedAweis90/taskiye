import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthModal } from './components/auth/AuthModal';
import { SplashScreen } from './components/common/SplashScreen';
import { ToastNotification } from './components/common/ToastNotification';
import { TrashModal } from './components/trash/TrashModal';

export const App: React.FC = () => {
  return (
    <>
      <SplashScreen />
      <ToastNotification />
      <TrashModal />
      <RouterProvider router={router} />
      <AuthModal />
    </>
  );
};

export default App;
