import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Mapa from '../telas/mapa';
import Registro from '../telas/registro';
import Ranking from '../telas/ranking';
import Conta from '../telas/conta';

const Tab = createBottomTabNavigator();

export default function Rotas() {
  return (
    <NavigationContainer>
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
          name="Ranking"
          component={Ranking}
        />
        
        <Tab.Screen
         name="Conta"
         component={Conta}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}