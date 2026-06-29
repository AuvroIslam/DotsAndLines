import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

import { Typography } from './Typography';

export function Loader({ message }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message ? (
        <Typography variant="body" muted>
          {message}
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg,
  },
});
