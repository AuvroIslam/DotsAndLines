import { useMemo } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { Typography } from './Typography';
import { FrameDots } from './FrameDots';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flattened = StyleSheet.flatten(style);
  const layoutStyle: ViewStyle = {
    flex: flattened?.flex,
    flexBasis: flattened?.flexBasis,
    flexGrow: flattened?.flexGrow,
    flexShrink: flattened?.flexShrink,
    width: flattened?.width,
    maxWidth: flattened?.maxWidth,
    minWidth: flattened?.minWidth,
    alignSelf: flattened?.alignSelf,
  };
  return (
    <View style={[styles.wrapper, layoutStyle]}>
      {label ? <Typography variant="caption">{label}</Typography> : null}
      <View style={styles.inputFrame}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, error ? styles.inputError : null, style]}
          {...rest}
        />
        <FrameDots color={error ? colors.danger : colors.surface} size={8} />
      </View>
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
    inputFrame: { position: 'relative', width: '100%' },
    input: {
      width: '100%',
      minHeight: 54,
      backgroundColor: colors.surface,
      borderRadius: 3,
      borderWidth: 2,
      borderColor: colors.surface,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Fredoka_500Medium',
    },
    inputError: { borderColor: colors.danger },
  });
