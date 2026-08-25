import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { PlayfulBackground } from './PlayfulBackground';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/** Standard screen container handling safe areas, background, and padding. */
export function Screen({ children, scroll = false, style, contentStyle }: ScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(width - spacing.lg * 2, 0), 728);

  const body = (
    <View style={[styles.content, { width: contentWidth }, contentStyle]}>{children}</View>
  );

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={styles.viewport}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  ) : (
    <View style={styles.viewport}>{body}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, style]}>
      <PlayfulBackground quiet />
      {inner}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    viewport: {
      width: '100%',
      boxSizing: 'border-box',
      flexGrow: 1,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    content: {
      alignSelf: 'center',
      gap: spacing.md,
      flexGrow: 1,
    },
  });
