import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { theme } from '@/theme';

import { Typography } from './Typography';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? (
        <Typography variant="caption" muted>
          {label}
        </Typography>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Typography variant="caption" color={theme.colors.danger}>
          {error}
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.xs },
  input: {
    height: 50,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 15,
  },
  inputError: { borderColor: theme.colors.danger },
});
