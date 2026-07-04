import { useMemo } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { Typography } from './Typography';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrapper}>
      {label ? (
        <Typography variant="caption" muted>
          {label}
        </Typography>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Typography variant="caption" color={colors.danger}>
          {error}
        </Typography>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrapper: { gap: spacing.xs },
    input: {
      height: 50,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 15,
    },
    inputError: { borderColor: colors.danger },
  });
