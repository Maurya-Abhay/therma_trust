import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { BadgeCheck, Plus, ShieldAlert, Tags } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchCapabilities } from '@/src/api/endpoints';
import { CapabilitySkill } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, Pill, PortalHero, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';
import { Button } from '@/src/components/ui/Button';
import { useTheme } from '@/src/theme/ThemeProvider';

type Filter = 'all' | 'verified' | 'pending' | 'not_qualified';
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Verified', value: 'verified' },
  { label: 'Pending', value: 'pending' },
  { label: 'Not qualified', value: 'not_qualified' },
];

export default function CapabilitiesScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const {
    data: capabilities = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['my-capabilities'],
    queryFn: () => fetchCapabilities('me'),
    staleTime: 30000,
  });

  const verified = capabilities.filter((item) => item.status === 'verified').length;
  const pending = capabilities.filter((item) => item.status === 'pending').length;
  const notQualified = capabilities.filter((item) => item.status === 'not_qualified').length;
  const filtered = capabilities.filter((item) => filter === 'all' || item.status === filter);
  const showLoadError = isError && capabilities.length === 0;

  const renderCapability = ({ item }: { item: CapabilitySkill }) => {
    const category = item.capability_type === 'equipment'
      ? item.equipment_category
      : item.capability_type === 'refrigerant'
        ? item.refrigerant_type_code
        : item.safety_domain;
    return (
      <Surface onPress={() => router.push(`/app/technician/capabilities/${item.id}` as any)} style={{ marginHorizontal: 18, marginBottom: 10, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBadge Icon={Tags} tone={toneFor(item.status)} size={42} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.label}</Text>
            <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, textTransform: 'capitalize' }}>{item.capability_type}{category ? ` · ${category}` : ''}</Text>
          </View>
          <StatusChip status={item.status} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
          <Pill text={`Evidence: ${item.evidence_type || 'not specified'}`} tone="info" />
          {item.verified_at ? <Pill text={`Verified ${format(new Date(item.verified_at), 'd MMM yyyy')}`} tone="ok" /> : null}
        </View>
        {item.note ? <Text numberOfLines={2} style={{ color: t.sub, fontSize: 12, marginTop: 9 }}>{item.note}</Text> : null}
      </Surface>
    );
  };

  return (
    <ScreenContainer headerTitle="Capabilities" showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={filtered}
        renderItem={renderCapability}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={t.primary} colors={[t.primary]} />}
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <PortalHero eyebrow="SKILLS & QUALIFICATIONS" title="Capabilities" subtitle="Review the skills and qualifications recorded on your profile." Icon={Tags} />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <Button
                  fullWidth
                  leftIcon={<Plus size={17} color="#FFFFFF" />}
                  style={{ marginTop: 14 }}
                  onPress={() => router.push('/app/technician/capabilities/create' as any)}
                >
                  Declare capability
                </Button>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={Tags} value={capabilities.length} label="Total" />
                  <Stat Icon={BadgeCheck} value={verified} label="Verified" tone="ok" />
                  <Stat Icon={ShieldAlert} value={pending + notQualified} label="To review" tone="warn" />
                </View>
                <Section title="Your skills" action={`${filtered.length} shown`} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 }}>
                  {FILTERS.map((item) => {
                    const active = filter === item.value;
                    return (
                      <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setFilter(item.value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.primary : t.card }}>
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={!isLoading && !showLoadError ? <State empty={filter === 'all' ? 'No capabilities recorded yet.' : `No ${filter.replace(/_/g, ' ')} capabilities.`} /> : undefined}
      />
    </ScreenContainer>
  );
}
