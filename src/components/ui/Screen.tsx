import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/** Standard screen container handling safe areas, background, and padding. */
export function Screen({ children, scroll = false, style, contentStyle }: ScreenProps) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return <SafeAreaView style={[styles.safe, style]}>{inner}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md, flexGrow: 1 },
});
