import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/components/providers/AppProviders';
import { Loader } from '@/components/ui';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { useAuthStore } from '@/store';
import { useAppColorScheme, useThemeColors } from '@/theme/useTheme';

function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const { ready } = useAppBootstrap();
  useProtectedRoute(status);
  const colors = useThemeColors();

  if (!ready) return <Loader message="Loading…" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useAppColorScheme();
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <AppProviders>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <RootNavigator />
    </AppProviders>
  );
}
