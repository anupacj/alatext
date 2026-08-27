import { Tabs } from 'expo-router';
import { MessageCircle, User } from 'lucide-react-native';
import { Platform, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme } = useTheme();

  return (
    <View style={styles.floatingWrapper} pointerEvents="box-none">
      <View style={[styles.pillContainer, { backgroundColor: theme.border }]}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const Icon = route.name === 'profile' ? User : MessageCircle;
          const color = isFocused ? theme.text : theme.textMuted;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabBtn}
            >
              <View style={[styles.iconCircle, isFocused && { backgroundColor: theme.surface }]}>
                <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  pillContainer: {
    flexDirection: 'row',
    width: 200,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  tabBtn: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
