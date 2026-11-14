import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, Clock3, MapPin, Timer, Users } from 'lucide-react-native';
import { fetchContractors, verifyContractorCompany } from '@/src/api/endpoints';
import { ContractorCompany } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Button } from '@/src/components/ui/Button';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
] as const;

export default function ContractorVerificationsReviewScreen() {
  const { t } = useTheme();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const {
    data: contractors = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-contractors'],
    queryFn: fetchContractors,
    staleTime: 30000,
  });

  const filtered = contractors.filter(
    (item) => statusFilter === 'all' || item.verification_status === statusFilter,
  );
  const pendingCount = contractors.filter((item) => item.verification_status === 'pending').length;
  const verifiedCount = contractors.filter((item) => item.verification_status === 'verified').length;
  const showLoadError = isError && contractors.length === 0;
  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => verifyContractorCompany(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-contractors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
    },
    onError: (error: any) => Alert.alert('Action failed', error.response?.data?.detail || 'Could not update this company.'),
  });

  const renderContractor = ({ item }: { item: ContractorCompany }) => (
    <Surface style={{ marginHorizontal: 18, marginBottom: 12, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <IconBadge Icon={Building2} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.name}</Text>
          <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11 }}>
            Registration {item.registration_number || 'not provided'}
          </Text>
        </View>
        <StatusChip status={item.verification_status} size="xs" />
      </View>

      <View style={{ height: 1, backgroundColor: t.line, marginVertical: 13 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <MapPin size={16} color={t.primary} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>SERVICE AREA</Text>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>
              {item.service_area || 'Not specified'}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Users size={16} color={t.primary} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>TEAM SIZE</Text>
            <Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>
              {item.technician_count} technicians
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
        <Timer size={15} color={t.sub} />
        <Text style={{ color: t.sub, fontSize: 11 }}>Response commitment</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>
          {item.response_time_commitment || 'Not specified'}
        </Text>
      </View>
      {item.verification_status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button size="sm" style={{ flex: 1 }} loading={reviewMutation.isPending} onPress={() => reviewMutation.mutate({ id: item.id, status: 'verified' })}>Verify</Button>
          <Button size="sm" variant="danger" style={{ flex: 1 }} loading={reviewMutation.isPending} onPress={() => reviewMutation.mutate({ id: item.id, status: 'rejected' })}>Reject</Button>
        </View>
      ) : null}
    </Surface>
  );

  return (
    <ScreenContainer
      headerTitle="Companies"
      headerSubtitle="Contractor verification management"
      showBack={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <FlatList
        data={filtered}
        renderItem={renderContractor}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <PortalHero
              eyebrow="ADMIN DIRECTORY"
              title="Companies"
              subtitle="Review contractor registrations, service areas, and verification."
              Icon={Building2}
            />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={Building2} value={contractors.length} label="Total" />
                  <Stat Icon={Clock3} value={pendingCount} label="Pending" tone="warn" />
                  <Stat Icon={BadgeCheck} value={verifiedCount} label="Verified" tone="ok" />
                </View>
                <Section title="Company status" action={`${filtered.length} results`} />
                <FlatList
                  horizontal
                  data={FILTERS}
                  keyExtractor={(item) => item.value}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                  renderItem={({ item }) => {
                    const active = statusFilter === item.value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setStatusFilter(item.value)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active ? t.primary : t.line,
                          backgroundColor: active ? t.primary : t.card,
                        }}
                      >
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{item.label}</Text>
                      </Pressable>
                    );
                  }}
                />
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !showLoadError ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 40 }}>
              <IconBadge Icon={Building2} size={54} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>No companies found</Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                There are no companies under this status.
              </Text>
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
