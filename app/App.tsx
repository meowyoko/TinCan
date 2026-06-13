import React, {useState} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {HomeScreen} from './src/screens/HomeScreen';
import {ChatScreen} from './src/screens/ChatScreen';

export type AppRoute = 'home' | 'chat';

function App(): React.JSX.Element {
  const [route, setRoute] = useState<AppRoute>('home');

  return (
    <SafeAreaProvider>
      {route === 'home' ? (
        <HomeScreen onOpenChat={() => setRoute('chat')} />
      ) : (
        <ChatScreen onBack={() => setRoute('home')} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
