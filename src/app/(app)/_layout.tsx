import { Stack, useRouter } from 'expo-router';

import { AppBackButton } from '@/components/ui';
import { useActiveGameWatcher } from '@/features/game';
import { Routes } from '@/navigation/routes';
import { useThemeColors } from '@/theme/useTheme';

/**
 * Renders nothing; just runs the active-game watcher. Isolated in its own
 * component so the watcher's `usePathname` re-renders only this leaf on every
 * navigation, not the whole `Stack` the layout returns.
 */
function ActiveGameWatcher(): null {
  useActiveGameWatcher();
  return null;
}

export default function AppLayout() {
  const colors = useThemeColors();
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.home);
  };
  return (
    <>
      <ActiveGameWatcher />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { fontFamily: 'Fredoka_600SemiBold' },
          headerTitleAlign: 'center',
          headerBackButtonDisplayMode: 'minimal',
          headerLeft: () => <AppBackButton onPress={goBack} />,
        }}
      >
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
        <Stack.Screen name="friend-requests" options={{ title: 'Friend Requests' }} />
        <Stack.Screen name="notifications" options={{ title: 'Invites' }} />
        <Stack.Screen name="create-room" options={{ title: 'Custom Room' }} />
        <Stack.Screen name="lobby/[roomId]" options={{ title: 'Lobby' }} />
        <Stack.Screen
          name="game/[gameId]"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="history" options={{ title: 'Match History' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="statistics" options={{ title: 'Statistics' }} />
        <Stack.Screen name="local-game" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
