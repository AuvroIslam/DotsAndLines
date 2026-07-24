import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/theme/useTheme';

import { Typography } from './Typography';

interface BadgeProps {
  /** Number to show. 0 or negative renders nothing. Values over 9 show "9+". */
  count: number;
  /** Absolutely position at the top-right of the parent (which must be relative). */
  floating?: boolean;
}

/** A small unread-count pill. Used on the Requests button and the invite bell. */
export function Badge({ count, floating }: BadgeProps) {
  const colors = useThemeColors();
  if (count <= 0) return null;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.danger, borderColor: colors.bg },
        floating && styles.floating,
      ]}
    >
      <Typography variant="caption" color="#fff" style={styles.text}>
        {count > 9 ? '9+' : count}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: { position: 'absolute', top: -6, right: -6 },
  text: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
