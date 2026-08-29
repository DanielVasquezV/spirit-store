import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, TextInput, View } from 'react-native';
import { Colors, Hairline, Radius, Spacing, Type } from '@/constants/theme';
import { IconButton } from '@/components/ui/icon-button';

type SearchBarProps = {
  placeholder?: string;
  onFilterPress?: () => void;
  onSearch?: (text: string) => void;
};

export function SearchBar({ placeholder = 'Buscar por marca o modelo', onFilterPress, onSearch }: SearchBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.inputWrap}>
        <Feather name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.text}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onChangeText={onSearch}
        />
      </View>
      {onFilterPress ? <IconButton icon="sliders" accessibilityLabel="Filtros" size={48} onPress={onFilterPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.sm,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    ...Type.body,
    color: Colors.text,
    padding: 0,
  },
});