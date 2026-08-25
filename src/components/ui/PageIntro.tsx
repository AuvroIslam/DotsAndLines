import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

import { BoardMark } from './BoardMark';
import { Typography } from './Typography';

interface PageIntroProps {
  title: string;
  subtitle: string;
  accent?: string;
}

export function PageIntro({ title, subtitle, accent }: PageIntroProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.intro}>
      <View style={styles.markRow}>
        <View style={[styles.rule, { backgroundColor: accent ?? colors.primary }]} />
        <BoardMark color={accent} size={44} />
        <View style={[styles.rule, { backgroundColor: accent ?? colors.primary }]} />
      </View>
      <View style={styles.copy}>
        <Typography variant="h2" center>
          {title}
        </Typography>
        <Typography variant="caption" muted center>
          {subtitle}
        </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { width: '100%', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  rule: { width: 36, height: 2, borderRadius: 1, opacity: 0.7 },
  copy: { width: '100%', alignItems: 'center', gap: 2 },
});
