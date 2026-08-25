import { StyleSheet, Switch, View } from 'react-native';

import {
  Card,
  IconBubble,
  type IconName,
  PageIntro,
  Screen,
  SegmentedControl,
  Typography,
} from '@/components/ui';
import { useAuthStore, useSettingsStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

function ToggleRow({
  label,
  value,
  onValueChange,
  icon,
  accent,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  icon: IconName;
  accent: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <IconBubble name={icon} color={accent} size={38} />
      <Typography variant="body" style={styles.label}>
        {label}
      </Typography>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.text}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const settings = useSettingsStore();
  const colors = useThemeColors();

  const patch = (p: Parameters<typeof settings.update>[1]) => {
    if (uid) void settings.update(uid, p);
  };

  return (
    <Screen contentStyle={styles.content}>
      <PageIntro
        title="Settings"
        subtitle="Tune the game to feel just right."
        accent={colors.purple}
      />
      <Card style={{ borderColor: colors.primary }}>
        <ToggleRow
          label="Sound effects"
          icon="volume-high"
          accent={colors.primary}
          value={settings.soundEnabled}
          onValueChange={(v) => patch({ soundEnabled: v })}
        />
        <ToggleRow
          label="Haptics"
          icon="phone-portrait"
          accent={colors.accent}
          value={settings.hapticsEnabled}
          onValueChange={(v) => patch({ hapticsEnabled: v })}
        />
        <ToggleRow
          label="Notifications"
          icon="notifications"
          accent={colors.warning}
          value={settings.notificationsEnabled}
          onValueChange={(v) => patch({ notificationsEnabled: v })}
        />
      </Card>

      <Card style={{ borderColor: colors.purple }}>
        <Typography variant="h3">Game table</Typography>
        <Typography variant="caption" muted>
          Choose the backdrop that feels most comfortable.
        </Typography>
        <SegmentedControl
          value={settings.themePreference}
          onChange={(v) => patch({ themePreference: v })}
          options={[
            { label: 'System', value: 'system' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 620 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  label: { flex: 1 },
});
