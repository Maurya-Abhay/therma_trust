import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CalendarDays, Clock3, FileCheck2, Users } from 'lucide-react-native';
import { fetchAllCredentials } from '@/src/api/endpoints';
import { Credential } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Chip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Document verified', value: 'document_verified' },
  { label: 'Issuer confirmed', value: 'issuer_confirmed' },
  { label: 'Platform verified', value: 'platform_verified' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Revoked', value: 'revoked' },
  { label: 'Rejected', value: 'rejected' },
] as const;

export default function CredentialsReviewScreen() {
  const { t } = useTheme();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const {
    data: credentials = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-credentials'],
    queryFn: fetchAllCredentials,
    staleTime: 30000,
  });

  const filtered = credentials.filter(
    (item) => statusFilter === 'all' || item.effective_status === statusFilter,
  );
  const pendingCount = credentials.filter((item) => item.effective_status === 'pending').length;
  const expiredCount = credentials.filter(
    (item) => !!item.expiry_date && new Date(item.expiry_date).getTime() < Date.now(),
  ).length;
  const showLoadError = isError && credentials.length === 0;

  const renderCredential = ({ item }: { item: Credential }) => {
    const expired = !!item.expiry_date && new Date(item.expiry_date).getTime() < Date.now();
    const flags = item.ai_check?.flags ?? [];

    return (
      <Surface style={{ marginHorizontal: 18, marginBottom: 12, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <IconBadge Icon={FileCheck2} size={42} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Users size={13} color={t.sub} />
              <Text numberOfLines={1} style={{ flex: 1, color: t.sub, fontSize: 11 }}>{item.technician_name}</Text>
            </View>
          </View>
          <StatusChip status={item.effective_status} size="sm" />
        </View>

        <View style={{ height: 1, backgroundColor: t.line, marginVertical: 13 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>ISSUING AUTHORITY</Text>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{item.issuer_name || 'Not provided'}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700' }}>CREDENTIAL NUMBER</Text>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 12 }}>{item.credential_number || 'Not provided'}</Text>
          </View>
        </View>

        {item.expiry_date ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
            <CalendarDays size={15} color={expired ? t.bad : t.sub} />
            <Text style={{ color: expired ? t.bad : t.sub, fontSize: 11, fontWeight: expired ? '700' : '500' }}>
              {expired ? 'Expired' : 'Expires'} {new Date(item.expiry_date).toLocaleDateString()}
            </Text>
          </View>
        ) : null}

        {flags.length ? (
          <View style={{ marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertCircle size={15} color={t.warn} />
              <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>AI review flags</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {flags.map((flag, index) => (
                <Chip key={`${flag.code}-${index}`} variant={flag.severity === 'warning' ? 'warning' : 'info'} size="xs">
                  {flag.message}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}
      </Surface>
    );
  };

  return (
    <ScreenContainer
      headerTitle="Reviews"
      headerSubtitle="Credential verification management"
      showBack={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
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
              eyebrow="ADMIN REVIEW"
              title="Credentials"
              subtitle="Review technician credentials and verification status."
              Icon={FileCheck2}
            />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={FileCheck2} value={credentials.length} label="Total" />
                  <Stat Icon={Clock3} value={pendingCount} label="Pending" tone="warn" />
                  <Stat Icon={CalendarDays} value={expiredCount} label="Expired" tone="bad" />
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
                          paddingHorizontal: 13,
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
              <IconBadge Icon={FileCheck2} size={54} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>No credentials found</Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                There are no credentials in this category.
              </Text>
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
