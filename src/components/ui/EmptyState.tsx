import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

import { BoardMark } from './BoardMark';
import { Card } from './Card';
import { Typography } from './Typography';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.markWrap}>
          <BoardMark size={58} />
        </View>
        <View style={[styles.rule, { backgroundColor: colors.primary }]} />
        <Typography variant="h3" center>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body" muted center>
            {subtitle}
          </Typography>
        ) : null}
      </Card>
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
  card: { width: '100%', maxWidth: 420, alignItems: 'center', padding: theme.spacing.xl },
  markWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  rule: { width: 48, height: 3, borderRadius: 2, marginBottom: theme.spacing.xs },
});
