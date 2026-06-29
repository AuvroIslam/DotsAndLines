import { Text, type TextProps, type TextStyle } from 'react-native';

import { theme } from '@/theme';

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
  const base: TextStyle = {
    ...theme.typography[variant],
    color: color ?? (muted ? theme.colors.textMuted : theme.colors.text),
    textAlign: center ? 'center' : undefined,
  };
  return <Text style={[base, style]} {...rest} />;
}
