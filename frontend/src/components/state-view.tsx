import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];

type StateViewProps = {
  icon: FeatherName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Estado vacío o de error compartido por las listas: mismo layout que los vacíos que ya tenían las pantallas.
export function StateView({ icon, title, body, actionLabel, onAction }: StateViewProps) {
  return (
    <View style={styles.wrap}>
      <Feather name={icon} size={40} color={Colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" size="sm" onPress={onAction} /> : null}
    </View>
  );
}

// Placeholder de una ProductCard mientras llega la página.
export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={20} />
      <Skeleton width="35%" height={20} />
      <Skeleton height={170} />
      <Skeleton width="45%" height={28} />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </View>
  );
}

// Carga de una pantalla de detalle: galería, título, precio y bloques de ficha.
export function DetailSkeleton() {
  return (
    <View style={styles.detail}>
      <Skeleton height={240} radius={Radius.md} />
      <Skeleton width="70%" height={28} />
      <Skeleton width="45%" height={32} />
      <Skeleton height={96} radius={Radius.md} />
      <Skeleton height={96} radius={Radius.md} />
    </View>
  );
}

// Página siguiente de una lista: una tarjeta fantasma en vez de un spinner.
export function ListFooterSkeleton({ visible }: { visible: boolean }) {
  return visible ? (
    <View style={styles.footer}>
      <ProductCardSkeleton />
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.huge, paddingHorizontal: Spacing.xxl },
  title: { ...Type.h3, color: Colors.text, textAlign: 'center' },
  body: { ...Type.body, color: Colors.textMuted, textAlign: 'center' },
  list: { gap: Layout.gap },
  detail: { gap: Spacing.lg, padding: Layout.screenX, paddingTop: Spacing.md },
  footer: { paddingTop: Layout.gap },
  card: {
    gap: Spacing.md,
    padding: Layout.cardPadding,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
});
