import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Colors, Hairline, Radius, Spacing, Type } from '@/constants/theme';

type FieldProps = TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
};

export function Field({ label, helper, error, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {/* Maneja el foco local y a la vez propaga los callbacks del consumidor */}
      <TextInput
        placeholderTextColor={Colors.textMuted}
        selectionColor={Colors.text}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        style={[styles.input, focused && styles.focused, !!error && styles.errored, rest.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs + 2 },
  label: { ...Type.label, color: Colors.textMuted },
  input: {
    height: 48,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.sm,
    borderWidth: Hairline,
    borderColor: Colors.border,
    ...Type.body,
    color: Colors.text,
  },
  focused: { borderWidth: 1, borderColor: Colors.borderFocus },
  errored: { borderWidth: 1, borderColor: Colors.danger },
  helper: { ...Type.caption, color: Colors.textMuted },
  error: { ...Type.caption, color: Colors.danger },
});