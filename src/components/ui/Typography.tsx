import { Text, type TextProps, type TextStyle } from 'react-native';

import { typography } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'caption';

interface TypographyProps extends TextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
}

export function Typography({
  variant = 'body',
  color,
  muted,
  center,
  style,
  ...rest
}: TypographyProps) {
  const colors = useThemeColors();
  const base: TextStyle = {
    ...typography[variant],
    color: color ?? (muted ? colors.textMuted : colors.text),
    textAlign: center ? 'center' : undefined,
  };
  return <Text style={[base, style]} {...rest} />;
}
