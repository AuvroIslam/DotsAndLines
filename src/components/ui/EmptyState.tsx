import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

import { Typography } from './Typography';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  emoji?: string;
}

export function EmptyState({ title, subtitle, emoji = '✨' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Typography variant="h1">{emoji}</Typography>
      <Typography variant="h3" center>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body" muted center>
          {subtitle}
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
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
});
