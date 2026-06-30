import { Stack } from 'expo-router';

import { theme } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="friends" options={{ title: 'Friends' }} />
      <Stack.Screen name="friend-requests" options={{ title: 'Friend Requests' }} />
      <Stack.Screen name="create-room" options={{ title: 'Create Room' }} />
      <Stack.Screen name="join-room" options={{ title: 'Join Room' }} />
      <Stack.Screen name="lobby/[roomId]" options={{ title: 'Lobby' }} />
      <Stack.Screen name="game/[gameId]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="history" options={{ title: 'Match History' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="statistics" options={{ title: 'Statistics' }} />
      <Stack.Screen name="local-game" options={{ headerShown: false }} />
    </Stack>
  );
}
