import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AutenticacaoProvider } from './src/contextos/autenticacao';
import Rotas from './src/navegacao/rotas';

export default function App() {
  return (
    <SafeAreaProvider>
      <AutenticacaoProvider>
        <Rotas />
      </AutenticacaoProvider>
    </SafeAreaProvider>
  );
}