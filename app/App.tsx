import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AutenticacaoProvider } from './src/contextos/autenticacao';
import { TemaProvider } from './src/contextos/tema';
import Rotas from './src/navegacao/rotas';

export default function App() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <AutenticacaoProvider>
          <Rotas />
        </AutenticacaoProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}
