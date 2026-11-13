import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  loading = false,
  error,
}: SelectFieldProps) {
  const { t } = useTheme();
  const [visible, setVisible] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <View style={{ width: '100%' }}>
        <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled, expanded: visible }}
          disabled={disabled || loading}
          onPress={() => setVisible(true)}
          style={({ pressed }) => [{
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            paddingHorizontal: 15,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: error ? t.bad : t.line,
            backgroundColor: t.field,
            opacity: disabled ? 0.6 : 1,
          }, pressed && { opacity: 0.8 }]}
        >
          <Text numberOfLines={1} style={{ flex: 1, color: selected ? t.text : t.sub, fontSize: 14 }}>
            {loading ? 'Loading options…' : selected?.label ?? placeholder}
          </Text>
          {loading ? <ActivityIndicator size="small" color={t.primary} /> : <ChevronDown size={18} color={t.sub} />}
        </Pressable>
        {error ? <Text style={{ color: t.bad, fontSize: 11, marginTop: 6, fontWeight: '600' }}>{error}</Text> : null}
      </View>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ width: '100%', maxHeight: '80%', borderRadius: 22, padding: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Text style={{ flex: 1, color: t.text, fontSize: 17, fontWeight: '800' }}>{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={() => setVisible(false)} hitSlop={10}>
                <X size={20} color={t.sub} />
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: 440 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}
            >
              {options.length ? options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onChange(option.value);
                      setVisible(false);
                    }}
                    style={({ pressed }) => [{
                      minHeight: 48,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 12,
                      borderRadius: 13,
                      backgroundColor: active ? t.tint : 'transparent',
                    }, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={{ flex: 1, color: active ? t.primary : t.text, fontSize: 14, fontWeight: active ? '700' : '500' }}>{option.label}</Text>
                    {active ? <Check size={18} color={t.primary} /> : null}
                  </Pressable>
                );
              }) : <Text style={{ color: t.sub, textAlign: 'center', padding: 20 }}>No options available.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
