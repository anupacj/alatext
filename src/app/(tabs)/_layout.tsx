import { Tabs } from 'expo-router';
import { MessageCircle, User } from 'lucide-react-native';
import { Platform, View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function TabsLayout() {
  const { theme } = useTheme();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.border,
            bottom: Platform.OS === 'web' ? 16 : (Platform.OS === 'ios' ? 20 : 16),
          }
        ],
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.surface }]}>
              <MessageCircle size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.surface }]}>
              <User size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: [{ translateX: Platform.OS === 'web' ? -100 : ('-50%' as any) }],
    width: 200,
    height: 56,
    borderRadius: 28,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabBarItem: {
    flex: 1,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
