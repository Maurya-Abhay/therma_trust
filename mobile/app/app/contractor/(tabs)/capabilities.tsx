import React from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Tags } from 'lucide-react-native';
import { fetchCapabilities, fetchContractorTechnicians, fetchContractors, verifyCapability } from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { CapabilitySkill } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

type CapabilityFilter = 'all' | 'pending' | 'verified' | 'not_qualified';

export default function ContractorCapabilitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const [filter, setFilter] = React.useState<CapabilityFilter>('all');
  const [refreshing, setRefreshing] = React.useState(false);

  const companyQuery = useQuery({
    queryKey: ['my-contractor-company'],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });
  const companyId = companyQuery.data?.[0]?.id;

  const rosterQuery = useQuery({
    queryKey: ['contractor-roster', companyId],
    queryFn: () => fetchContractorTechnicians(companyId!),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
  const roster = rosterQuery.data ?? [];
  const technicianIds = roster.map((technician) => technician.id).sort((a, b) => a - b);

  const capabilitiesQuery = useQuery({
    queryKey: ['team-capabilities', companyId, technicianIds],
    queryFn: async () => {
      const byTechnician = await Promise.all(technicianIds.map((id) => fetchCapabilities(id)));
      return byTechnician.flat();
    },
    enabled: Boolean(companyId) && rosterQuery.isSuccess,
    staleTime: 30_000,
  });
  const capabilities = capabilitiesQuery.data ?? [];

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'verified' | 'not_qualified' }) => verifyCapability(id, status),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['team-capabilities', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['pending-approvals', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['contractor-compliance', companyId] }),
      ]);
      Alert.alert('Capability reviewed', variables.status === 'verified' ? 'The capability is now verified.' : 'The capability was marked not qualified.');
    },
    onError: (error) => Alert.alert('Could not update capability', getApiErrorMessage(error, 'Please try again.')),
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([rosterQuery.refetch(), capabilitiesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const counts = React.useMemo(() => ({
    pending: capabilities.filter((item) => item.status === 'pending').length,
    verified: capabilities.filter((item) => item.status === 'verified').length,
    notQualified: capabilities.filter((item) => item.status === 'not_qualified').length,
  }), [capabilities]);
  const filtered = filter === 'all' ? capabilities : capabilities.filter((item) => item.status === filter);
  const technicianNames = React.useMemo(
    () => new Map(roster.map((technician) => [technician.id, technician.full_name])),
    [roster],
  );

  if (companyQuery.isLoading) {
    return <ScreenContainer headerTitle="Team capabilities"><State loading /></ScreenContainer>;
  }
  if (companyQuery.isError) {
    return <ScreenContainer headerTitle="Team capabilities"><State error onRetry={() => { void companyQuery.refetch(); }} /></ScreenContainer>;
  }
  if (!companyId) {
    return (
      <ScreenContainer headerTitle="Team capabilities">
        <Surface style={{ alignItems: 'center', padding: 24, gap: 12 }}>
          <IconBadge Icon={Tags} size={50} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Register your company first</Text>
          <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12, lineHeight: 18 }}>Create a company profile before reviewing team capabilities.</Text>
          <Button onPress={() => router.push('/app/contractor/company')}>Open company setup</Button>
        </Surface>
      </ScreenContainer>
    );
  }

  const loading = rosterQuery.isLoading || (rosterQuery.isSuccess && capabilitiesQuery.isLoading);
  const hasError = rosterQuery.isError || capabilitiesQuery.isError;

  return (
    <ScreenContainer headerTitle="Team capabilities" headerSubtitle={`${roster.length} technicians`} contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={t.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <PortalHero eyebrow="TEAM QUALIFICATIONS" title="Capabilities review" subtitle="Review and verify the skills submitted by your technicians." Icon={BadgeCheck} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <CountCard label="Pending" value={counts.pending} />
              <CountCard label="Verified" value={counts.verified} />
              <CountCard label="Not qualified" value={counts.notQualified} />
            </View>
            <Section title="Submissions" action={`${capabilities.length} total`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              {(['all', 'pending', 'verified', 'not_qualified'] as const).map((value) => (
                <Chip key={value} variant={filter === value ? 'primary' : 'default'} onPress={() => setFilter(value)}>
                  {value === 'all' ? 'All' : value.replace(/_/g, ' ')}
                </Chip>
              ))}
            </ScrollView>
            {hasError ? <State error onRetry={() => { void refresh(); }} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <CapabilityRow
            capability={item}
            technicianName={technicianNames.get(item.technician) ?? item.technician_name}
            reviewingStatus={verifyMutation.isPending && verifyMutation.variables?.id === item.id ? verifyMutation.variables.status : null}
            onReview={(status) => verifyMutation.mutate({ id: item.id, status })}
          />
        )}
        ListEmptyComponent={loading ? <State loading /> : !hasError ? (
          <Surface style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <IconBadge Icon={Tags} tone="info" size={44} />
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 14 }}>
              {roster.length ? 'No capability submissions' : 'No technicians in your roster'}
            </Text>
            <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>
              {roster.length ? 'Technician submissions will appear here for review.' : 'Add technicians to your company roster to manage their capabilities.'}
            </Text>
            {!roster.length ? <Button size="sm" onPress={() => router.push('/app/contractor/roster')}>Manage roster</Button> : null}
          </Surface>
        ) : undefined}
      />
    </ScreenContainer>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  const { t } = useTheme();
  return (
    <Surface style={{ flex: 1, padding: 12 }}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: t.sub, fontSize: 10, fontWeight: '600', marginTop: 3 }}>{label}</Text>
    </Surface>
  );
}

function CapabilityRow({
  capability,
  technicianName,
  reviewingStatus,
  onReview,
}: {
  capability: CapabilitySkill;
  technicianName: string;
  reviewingStatus: 'verified' | 'not_qualified' | null;
  onReview: (status: 'verified' | 'not_qualified') => void;
}) {
  const { t } = useTheme();
  return (
    <Surface style={{ marginBottom: 10, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <IconBadge Icon={Tags} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>{capability.label}</Text>
          <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{technicianName}</Text>
        </View>
        <StatusChip status={capability.status} size="sm" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <Chip variant="info" size="xs">{capability.capability_type}</Chip>
        <Chip variant="default" size="xs">{capability.evidence_type.replace(/_/g, ' ')}</Chip>
      </View>
      {capability.note ? <Text style={{ color: t.sub, fontSize: 11, lineHeight: 16, marginTop: 8 }}>{capability.note}</Text> : null}
      {capability.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button size="sm" loading={reviewingStatus === 'verified'} disabled={Boolean(reviewingStatus)} onPress={() => onReview('verified')} style={{ flex: 1 }}>Verify</Button>
          <Button size="sm" variant="outline" loading={reviewingStatus === 'not_qualified'} disabled={Boolean(reviewingStatus)} onPress={() => onReview('not_qualified')} style={{ flex: 1 }}>Not qualified</Button>
        </View>
      ) : null}
    </Surface>
  );
}
