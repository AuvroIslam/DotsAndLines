import { StyleSheet, Switch, View } from 'react-native';

import { Card, Screen, SegmentedControl, Typography } from '@/components/ui';
import { useAuthStore, useSettingsStore } from '@/store';
import { theme } from '@/theme';

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Typography variant="body">{label}</Typography>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor={theme.colors.text}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const settings = useSettingsStore();

  const patch = (p: Parameters<typeof settings.update>[1]) => {
    if (uid) void settings.update(uid, p);
  };

  return (
    <Screen>
      <Card>
        <ToggleRow
          label="Sound effects"
          value={settings.soundEnabled}
          onValueChange={(v) => patch({ soundEnabled: v })}
        />
        <ToggleRow
          label="Haptics"
          value={settings.hapticsEnabled}
          onValueChange={(v) => patch({ hapticsEnabled: v })}
        />
        <ToggleRow
          label="Notifications"
          value={settings.notificationsEnabled}
          onValueChange={(v) => patch({ notificationsEnabled: v })}
        />
      </Card>

      <Card>
        <Typography variant="caption" muted>
          Theme
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
});
