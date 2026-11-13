import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { AlertTriangle, BadgeCheck, CalendarDays, FileBadge, Plus, ShieldCheck } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchCredentials } from '@/src/api/endpoints';
import { Credential } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { NotificationHeaderAction } from '@/src/components/technician/NotificationHeaderAction';
import { StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, Pill, PortalHero, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

type CredentialFilter = 'all' | 'pending' | 'verified' | 'attention';

const FILTERS: { label: string; value: CredentialFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Needs attention', value: 'attention' },
];

const VERIFIED_STATUSES = ['verified', 'document_verified', 'issuer_confirmed', 'platform_verified'];
const ATTENTION_STATUSES = ['rejected', 'suspended', 'revoked'];
const isExpired = (item: Credential) => !!item.expiry_date && new Date(item.expiry_date).getTime() < Date.now();
const isVerified = (item: Credential) => VERIFIED_STATUSES.includes(item.effective_status) && !isExpired(item);
const needsAttention = (item: Credential) => ATTENTION_STATUSES.includes(item.effective_status) || isExpired(item);

export default function TechnicianCredentialsScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [filter, setFilter] = useState<CredentialFilter>('all');
  const {
    data: credentials = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['my-credentials'],
    queryFn: () => fetchCredentials('me'),
    staleTime: 60000,
  });

  const verifiedCount = credentials.filter(isVerified).length;
  const reviewCount = credentials.filter((item) => item.effective_status === 'pending' || needsAttention(item)).length;
  const filtered = credentials.filter((item) => {
    if (filter === 'pending') return item.effective_status === 'pending';
    if (filter === 'verified') return isVerified(item);
    if (filter === 'attention') return needsAttention(item);
    return true;
  });
  const showLoadError = isError && credentials.length === 0;

  const renderCredential = ({ item }: { item: Credential }) => {
    const expired = isExpired(item);
    return (
      <Surface
        onPress={() => router.push(`/app/technician/credentials/${item.id}` as any)}
        style={{ marginHorizontal: 18, marginBottom: 10, padding: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBadge Icon={FileBadge} tone={expired ? 'bad' : toneFor(item.effective_status)} size={42} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.name}</Text>
            <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11 }}>{item.issuer_name}</Text>
          </View>
          <StatusChip status={item.effective_status} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
          {item.credential_number ? <Pill text={`No. ${item.credential_number}`} tone="info" /> : null}
          {item.expiry_date ? (
            <Pill text={`${expired ? 'Expired' : 'Expires'} ${format(new Date(item.expiry_date), 'd MMM yyyy')}`} tone={expired ? 'bad' : 'primary'} />
          ) : null}
          {item.ai_check?.flags.length ? <Pill text={`${item.ai_check.flags.length} document flag${item.ai_check.flags.length === 1 ? '' : 's'}`} tone="warn" /> : null}
        </View>
      </Surface>
    );
  };

  return (
    <ScreenContainer headerTitle="Credentials" showBack={false} showBrand headerRightAction={<NotificationHeaderAction />} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={filtered}
        renderItem={renderCredential}
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
              eyebrow="MY DOCUMENTS"
              title="Credentials"
              subtitle="Keep your certificates current and ready for verification."
              Icon={ShieldCheck}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/app/technician/credentials/create' as any)}
              style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.primary }}
            >
              <Plus size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Add credential</Text>
            </Pressable>
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 10 }}>
                  <Stat Icon={FileBadge} value={credentials.length} label="Total" />
                  <Stat Icon={BadgeCheck} value={verifiedCount} label="Verified" tone="ok" />
                  <Stat Icon={AlertTriangle} value={reviewCount} label="To review" tone="warn" />
                </View>
                <Section title="Your credentials" action={`${filtered.length} shown`} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 }}>
                  {FILTERS.map((item) => {
                    const active = filter === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setFilter(item.value)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.primary : t.card }}
                      >
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !showLoadError ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 38 }}>
              <IconBadge Icon={FileBadge} size={54} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>
                {filter === 'all' ? 'No credentials yet' : `No ${filter === 'attention' ? 'credentials needing attention' : filter + ' credentials'}`}
              </Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                Add your certificates so they can be reviewed and verified.
              </Text>
              {filter === 'all' ? (
                <Pressable onPress={() => router.push('/app/technician/credentials/create' as any)} style={{ marginTop: 14 }}>
                  <Text style={{ color: t.primary, fontSize: 13, fontWeight: '800' }}>Add a credential</Text>
                </Pressable>
              ) : null}
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
