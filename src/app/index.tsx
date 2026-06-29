import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui';
import { theme } from '@/theme';

/**
 * Splash / landing at "/". The root layout's auth gate immediately redirects to
 * the (auth) or (app) group once auth status resolves, so this is only visible
 * for a frame during cold start.
 */
export default function Splash() {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Typography variant="h1">⬛</Typography>
      </View>
      <Typography variant="h1">Dots & Boxes</Typography>
      <Typography variant="body" muted>
        Connect the dots. Claim the boxes.
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    gap: theme.spacing.sm,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
});
