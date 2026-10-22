import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Mapa from '../telas/mapa';
import Registro from '../telas/registro';
import Ranking from '../telas/ranking';
import Conta from '../telas/conta';
import Ocorrencias from '../telas/ocorrencias';

export type RootStackParamList = {
  Principal: undefined;
  Ocorrencia: {
    ocorrenciaId: string;
  };
};

const Tab = createBottomTabNavigator();
const Stack =
  createNativeStackNavigator<RootStackParamList>();

function AbasPrincipais() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    >
      <Tab.Screen
        name="Mapa"
        component={Mapa}
      />

      <Tab.Screen
        name="Registro"
        component={Registro}
      />

      <Tab.Screen
        name="Ocorrências"
        component={Ocorrencias}
      />

      <Tab.Screen
        name="Ranking"
        component={Ranking}
      />

      <Tab.Screen
        name="Conta"
        component={Conta}
      />
    </Tab.Navigator>
  );
}

export default function Rotas() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Principal"
          component={AbasPrincipais}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="Ocorrencia"
          component={Ocorrencias}
          options={{
            title: 'Ocorrência',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
