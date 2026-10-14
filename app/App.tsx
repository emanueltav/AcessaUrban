import { SafeAreaProvider } from 'react-native-safe-area-context';

import Rotas from './src/navegacao/rotas';

export default function App() {
  return (
    <SafeAreaProvider>
      <Rotas />
    </SafeAreaProvider>
  );
}