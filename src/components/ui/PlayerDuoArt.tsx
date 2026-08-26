import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

interface PlayerDuoArtProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

const source = require('../../../assets/illustrations/human-duo-hero.png');

/** The game's human character pair, used as a consistent visual anchor across the app. */
export function PlayerDuoArt({ size = 210, style }: PlayerDuoArtProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={source}
      resizeMode="contain"
      style={[styles.image, { width: size, height: size }, style]}
    />
  );
}

const styles = StyleSheet.create({ image: { alignSelf: 'center' } });
