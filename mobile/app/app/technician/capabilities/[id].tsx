import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BadgeCheck, ShieldCheck, Tags } from 'lucide-react-native';
import { fetchCapability, verifyCapability } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, Pill, Section, State, Surface, toneFor } from '@/src/components/ui/kit';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function CapabilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const capabilityId = Number(id);
  const { user } = useAuth();
  const { t } = useTheme();
  const queryClient = useQueryClient();

  const {
    data: capability,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['capability', capabilityId],
    queryFn: () => fetchCapability(capabilityId),
    enabled: Number.isInteger(capabilityId) && capabilityId > 0,
  });

  const verifyMutation = useMutation({
    mutationFn: (status: string) => verifyCapability(capabilityId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['capability', capabilityId] }),
        queryClient.invalidateQueries({ queryKey: ['my-capabilities'] }),
        queryClient.invalidateQueries({ queryKey: ['capabilities'] }),
      ]);
      Alert.alert('Updated', 'Capability status has been updated.');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.detail || 'Failed to update capability status.'),
  });

  if (isLoading || isError || !capability) {
    return (
      <ScreenContainer headerTitle="Capability" showProfile={false}>
        <State loading={isLoading} error={isError} empty={!isLoading && !isError ? 'Capability not found.' : undefined} onRetry={() => { void refetch(); }} />
      </ScreenContainer>
    );
  }

  const canVerify = user?.role === 'admin' || user?.role === 'contractor_manager';
  const category = capability.capability_type === 'equipment'
    ? capability.equipment_category
    : capability.capability_type === 'refrigerant'
      ? capability.refrigerant_type_code
      : capability.safety_domain;

  return (
    <ScreenContainer headerTitle={capability.label} showProfile={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <Surface style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge Icon={Tags} tone={toneFor(capability.status)} size={48} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{capability.label}</Text>
              <Text style={{ color: t.sub, fontSize: 12, textTransform: 'capitalize' }}>{capability.capability_type} capability</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusChip status={capability.status} />
            <Pill text={capability.capability_type} tone="info" />
          </View>
        </Surface>

        <Section title="Capability details" />
        <Surface style={{ gap: 13 }}>
          {[
            ['Technician', capability.technician_name],
            ['Category', category || 'Not specified'],
            ['Evidence type', capability.evidence_type || 'Not specified'],
            ['Note', capability.note || 'No notes'],
            ...(capability.verified_at ? [
              ['Verified by', capability.verified_by ? `User #${capability.verified_by}` : '—'],
              ['Verified date', format(new Date(capability.verified_at), 'd MMM yyyy, h:mm a')],
            ] : []),
          ].map(([label, value]) => (
            <View key={label} style={{ gap: 3 }}>
              <Text style={{ color: t.sub, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' }}>{label}</Text>
              <Text style={{ color: t.text, fontSize: 13, lineHeight: 19 }}>{value}</Text>
            </View>
          ))}
        </Surface>

        {canVerify && capability.status !== 'verified' ? (
          <>
            <Section title="Verification actions" />
            <Surface style={{ gap: 9 }}>
              <Button
                variant="primary"
                loading={verifyMutation.isPending}
                disabled={verifyMutation.isPending}
                leftIcon={<BadgeCheck size={16} color="#FFFFFF" />}
                onPress={() => verifyMutation.mutate('verified')}
              >
                Verify capability
              </Button>
              <Button
                variant="danger"
                loading={verifyMutation.isPending}
                disabled={verifyMutation.isPending}
                leftIcon={<ShieldCheck size={16} color="#FFFFFF" />}
                onPress={() => verifyMutation.mutate('not_qualified')}
              >
                Mark not qualified
              </Button>
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
