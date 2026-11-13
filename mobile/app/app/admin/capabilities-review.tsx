import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, Clock3, UserRound } from 'lucide-react-native';
import { fetchAllCapabilities } from '@/src/api/endpoints';
import { CapabilitySkill } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Chip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Not qualified', value: 'not_qualified' },
] as const;

export default function CapabilitiesReviewScreen() {
  const { t } = useTheme();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const {
    data: capabilities = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-capabilities'],
    queryFn: fetchAllCapabilities,
    staleTime: 30000,
  });

  const filtered = capabilities.filter((item) => statusFilter === 'all' || item.status === statusFilter);
  const pendingCount = capabilities.filter((item) => item.status === 'pending').length;
  const verifiedCount = capabilities.filter((item) => item.status === 'verified').length;
  const showLoadError = isError && capabilities.length === 0;

  const renderCapability = ({ item }: { item: CapabilitySkill }) => {
    const details =
      item.capability_type === 'equipment'
        ? item.equipment_category
        : item.capability_type === 'refrigerant'
          ? item.refrigerant_type_code
          : item.capability_type === 'safety'
            ? item.safety_domain
            : null;

    return (
      <Surface style={{ marginHorizontal: 18, marginBottom: 12, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <IconBadge Icon={BadgeCheck} size={42} />
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <UserRound size={13} color={t.sub} />
              <Text numberOfLines={1} style={{ flex: 1, color: t.sub, fontSize: 11 }}>{item.technician_name}</Text>
            </View>
          </View>
          <StatusChip status={item.status} size="sm" />
        </View>

        <View style={{ height: 1, backgroundColor: t.line, marginVertical: 13 }} />
        <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700', marginBottom: 8 }}>CAPABILITY DETAILS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Chip variant="info" size="sm">{item.capability_type}</Chip>
          {details ? <Chip variant="default" size="sm">{details}</Chip> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>EVIDENCE TYPE</Text>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{item.evidence_type || 'Not provided'}</Text>
          </View>
          {item.verified_at ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <CalendarDays size={15} color={t.sub} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>VERIFIED ON</Text>
                <Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{new Date(item.verified_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ) : item.status === 'pending' ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Clock3 size={15} color={t.sub} />
              <Text style={{ color: t.sub, fontSize: 11 }}>Awaiting review</Text>
            </View>
          ) : null}
        </View>
      </Surface>
    );
  };

  return (
    <ScreenContainer
      headerTitle="Skills Review"
      showBack
      showProfile={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <FlatList
        data={filtered}
        renderItem={renderCapability}
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
              eyebrow="ADMIN REVIEW"
              title="Technician capabilities"
              subtitle="Review technician skills, evidence, and qualification status."
              Icon={BadgeCheck}
            />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={BadgeCheck} value={capabilities.length} label="Total" />
                  <Stat Icon={Clock3} value={pendingCount} label="Pending" tone="warn" />
                  <Stat Icon={CalendarDays} value={verifiedCount} label="Verified" tone="ok" />
                </View>
                <Section title="Review status" action={`${filtered.length} results`} />
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
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
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
              <IconBadge Icon={BadgeCheck} size={54} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>No skills found</Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                No capability records match this status.
              </Text>
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
