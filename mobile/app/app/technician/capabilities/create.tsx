import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { fetchChoices, fetchMyTechnicianProfile, fetchRefrigerantTypes, createCapability } from '@/src/api/endpoints';
import { CapabilitySkill, Option } from '@/src/types/api';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

type CapabilityType = CapabilitySkill['capability_type'];

const TYPES: { label: string; value: CapabilityType }[] = [
  { label: 'Equipment', value: 'equipment' },
  { label: 'Refrigerant', value: 'refrigerant' },
  { label: 'Safety domain', value: 'safety' },
];

export default function CreateCapabilityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const profile = useQuery({ queryKey: ['my-technician-profile'], queryFn: fetchMyTechnicianProfile });
  const choices = useQuery({ queryKey: ['choices'], queryFn: fetchChoices });
  const refrigerants = useQuery({ queryKey: ['refrigerant-types'], queryFn: fetchRefrigerantTypes });
  const [capabilityType, setCapabilityType] = useState<CapabilityType>('equipment');
  const [selectedValue, setSelectedValue] = useState('');
  const [note, setNote] = useState('');

  const options = useMemo<Option[]>(() => {
    if (capabilityType === 'equipment') return choices.data?.equipment_categories ?? [];
    if (capabilityType === 'safety') return choices.data?.safety_domains ?? [];
    return (refrigerants.data ?? []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }));
  }, [capabilityType, choices.data, refrigerants.data]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!profile.data) throw new Error('No technician profile was found.');
      const payload: Partial<CapabilitySkill> = {
        technician: profile.data.id,
        capability_type: capabilityType,
        equipment_category: capabilityType === 'equipment' ? selectedValue : '',
        refrigerant_type: capabilityType === 'refrigerant' ? Number(selectedValue) : null,
        safety_domain: capabilityType === 'safety' ? selectedValue : '',
        evidence_type: 'none',
        note: note.trim(),
      };
      return createCapability(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-capabilities'] }),
        queryClient.invalidateQueries({ queryKey: ['capabilities'] }),
        queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
      ]);
      Alert.alert('Capability submitted', 'Your capability is pending verification.');
      router.back();
    },
  });

  const optionsLoading = capabilityType === 'refrigerant' ? refrigerants.isLoading : choices.isLoading;
  const optionsError = capabilityType === 'refrigerant' ? refrigerants.isError : choices.isError;

  return (
    <ScreenContainer headerTitle="Declare capability" showProfile={false}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <Surface style={{ gap: 16 }}>
          <Text style={{ color: t.sub, fontSize: 13, lineHeight: 19 }}>
            Choose a skill you can perform. New capabilities are submitted as pending until a reviewer verifies them.
          </Text>

          <View style={{ gap: 8 }}>
            <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700' }}>Capability type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TYPES.map((item) => {
                const active = capabilityType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => { setCapabilityType(item.value); setSelectedValue(''); }}
                    style={{ borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.tint : t.card, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 9 }}
                  >
                    <Text style={{ color: active ? t.primary : t.sub, fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700' }}>Capability</Text>
            {optionsLoading ? <State loading /> : optionsError ? (
              <State error onRetry={() => { void (capabilityType === 'refrigerant' ? refrigerants.refetch() : choices.refetch()); }} />
            ) : options.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map((item) => {
                  const active = selectedValue === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedValue(item.value)}
                      style={{ borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.tint : t.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ color: active ? t.primary : t.text, fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : <Text style={{ color: t.sub, fontSize: 12 }}>No options are available for this type.</Text>}
          </View>

          <Input
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            maxLength={300}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholder="Add context for the reviewer"
          />

          {profile.isLoading ? <State loading /> : profile.isError ? (
            <State error onRetry={() => { void profile.refetch(); }} />
          ) : !profile.data ? (
            <Text style={{ color: t.bad, fontSize: 12 }}>No technician profile was found for this account.</Text>
          ) : null}
          {mutation.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{getApiErrorMessage(mutation.error, 'Could not submit this capability. Please try again.')}</Text> : null}
          <Button
            fullWidth
            loading={mutation.isPending}
            disabled={!profile.data || !selectedValue || optionsLoading || optionsError}
            onPress={() => mutation.mutate()}
          >
            Submit for verification
          </Button>
        </Surface>
      </ScrollView>
    </ScreenContainer>
  );
}
