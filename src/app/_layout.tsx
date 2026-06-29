import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/components/providers/AppProviders';
import { Loader } from '@/components/ui';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { useAuthStore } from '@/store';

function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const { ready } = useAppBootstrap();
  useProtectedRoute(status);

  if (!ready) return <Loader message="Loading…" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0E1116' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <RootNavigator />
    </AppProviders>
  );
}
