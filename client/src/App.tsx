import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthModal } from './components/auth/AuthModal';
import { SplashScreen } from './components/common/SplashScreen';
import { ToastNotification } from './components/common/ToastNotification';

export const App: React.FC = () => {
  return (
    <>
      <SplashScreen />
      <ToastNotification />
      <RouterProvider router={router} />
      <AuthModal />
    </>
  );
};

export default App;
