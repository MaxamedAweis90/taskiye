import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthModal } from './components/auth/AuthModal';
import { SplashScreen } from './components/common/SplashScreen';

export const App: React.FC = () => {
  return (
    <>
      <SplashScreen />
      <RouterProvider router={router} />
      <AuthModal />
    </>
  );
};

export default App;
